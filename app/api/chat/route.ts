import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  convertToModelMessages,
  JSONSchema7,
  streamText,
  type UIMessage,
} from "ai";
import { getCurrentUser } from "@/lib/auth";
import { replaceThreadMessages } from "@/lib/chat-db";
import { bigqueryTools } from "@/lib/bigquery-tools";
import { buildRuntimeContext } from "@/lib/runtime-context";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

const arkApiKey = process.env.ARK_API_KEY ?? process.env.DEEPSEEK_KEY;
const defaultChatModel =
  process.env.CHAT_MODEL ??
  process.env.ARK_CHAT_MODEL ??
  process.env.NEWAPI_CHAT_MODEL;
const newApiApiKey = process.env.NEWAPI_API_KEY;

function normalizeOpenAICompatibleBaseURL(baseURL: string | undefined) {
  if (!baseURL) return undefined;

  const normalized = baseURL.trim().replace(/\/+$/, "");
  if (!normalized) return undefined;

  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

const newApiBaseURL = normalizeOpenAICompatibleBaseURL(
  process.env.NEWAPI_BASE_URL ?? "http://newapi.dditapp.com",
);
const newApiClaudeModels = new Set(["claude-opus-4-6", "claude-sonnet-4-6"]);
const INVALID_THREAD_IDS = new Set(["DEFAULT_THREAD_ID", "__DEFAULT_ID__"]);

const analystGuidePrompt = fs.readFileSync(
  path.join(process.cwd(), "prompts/analyst-guide.md"),
  "utf-8",
);

const bigSkillPrompt = fs.readFileSync(
  path.join(process.cwd(), "prompts/big-skill.md"),
  "utf-8",
);

const ark = createOpenAI({
  name: "volcengine",
  apiKey: arkApiKey,
  baseURL: "https://ark.cn-beijing.volces.com/api/v3",
});

const newApi = createOpenAI({
  name: "newapi",
  apiKey: newApiApiKey,
  ...(newApiBaseURL ? { baseURL: newApiBaseURL } : {}),
});

function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      ...message,
      parts: message.parts.filter((part) => {
        if (part.type === "text" || part.type === "reasoning") {
          return part.text.trim().length > 0;
        }

        return true;
      }),
    }))
    .filter((message) => {
      if (message.role === "assistant") {
        return message.parts.length > 0;
      }

      return true;
    });
}

function resolveChatModel(modelName: string) {
  if (newApiClaudeModels.has(modelName)) {
    if (!newApiApiKey) {
      throw new Error(
        "Missing `NEWAPI_API_KEY` environment variable for Claude models.",
      );
    }

    if (!newApiBaseURL) {
      throw new Error(
        "Missing `NEWAPI_BASE_URL` environment variable for Claude models.",
      );
    }

    return newApi.chat(modelName);
  }

  if (!arkApiKey) {
    throw new Error("Missing `ARK_API_KEY` or `DEEPSEEK_KEY` environment variable.");
  }

  return ark.chat(modelName);
}

function resolvePersistedThreadId(id: string | undefined) {
  if (!id) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  const normalized = id.trim();

  if (!normalized || INVALID_THREAD_IDS.has(normalized)) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return normalized;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    id,
    messages,
    system,
    tools,
    config,
  }: {
    id?: string;
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
    config?: {
      modelName?: string;
    };
  } = await req.json();

  const resolvedModelName =
    typeof config?.modelName === "string" && config.modelName.trim().length > 0
      ? config.modelName.trim()
      : defaultChatModel;

  if (!resolvedModelName) {
    throw new Error(
      "Missing `CHAT_MODEL`, `ARK_CHAT_MODEL`, or `NEWAPI_CHAT_MODEL` environment variable.",
    );
  }

  const sanitizedMessages = sanitizeMessages(messages);
  const threadId = resolvePersistedThreadId(id);

  const result = streamText({
    model: resolveChatModel(resolvedModelName),
    messages: await convertToModelMessages(sanitizedMessages),
    tools: {
      ...frontendTools(tools ?? {}),
      ...bigqueryTools,
    },
    system: [buildRuntimeContext(), analystGuidePrompt, bigSkillPrompt, system]
      .filter(Boolean)
      .join("\n\n"),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: sanitizedMessages,
    onFinish: async ({ messages: completedMessages }) => {
      await replaceThreadMessages({
        userId: user.id,
        threadId,
        messages: sanitizeMessages(completedMessages),
        modelName: resolvedModelName,
      });
    },
  });
}
