import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import {
  convertToModelMessages,
  JSONSchema7,
  streamText,
  type UIMessage,
} from "ai";
import { bigqueryTools } from "@/lib/bigquery-tools";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

const volcengineApiKey = process.env.ARK_API_KEY ?? process.env.DEEPSEEK_KEY;
const defaultVolcengineChatModel = process.env.ARK_CHAT_MODEL;

const bigSkillPrompt = fs.readFileSync(
  path.join(process.cwd(), "prompts/big-skill.md"),
  "utf-8",
);

const volcengine = createOpenAI({
  name: "volcengine",
  apiKey: volcengineApiKey,
  baseURL: "https://ark.cn-beijing.volces.com/api/v3",
});

export async function POST(req: Request) {
  if (!volcengineApiKey) {
    throw new Error("Missing `ARK_API_KEY` or `DEEPSEEK_KEY` environment variable.");
  }

  if (!defaultVolcengineChatModel) {
    throw new Error("Missing `ARK_CHAT_MODEL` environment variable.");
  }

  const {
    messages,
    system,
    tools,
    config,
  }: {
    messages: UIMessage[];
    system?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
    config?: {
      modelName?: string;
    };
  } = await req.json();

  const resolvedModelName =
    typeof config?.modelName === "string" && config.modelName.trim().length > 0
      ? config.modelName
      : defaultVolcengineChatModel;

  const result = streamText({
    model: volcengine.chat(resolvedModelName),
    messages: await convertToModelMessages(messages),
    tools: {
      ...frontendTools(tools ?? {}),
      ...bigqueryTools,
    },
    system: system ? `${bigSkillPrompt}\n\n${system}` : bigSkillPrompt,
  });

  return result.toUIMessageStreamResponse();
}
