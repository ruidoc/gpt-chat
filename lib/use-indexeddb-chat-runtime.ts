"use client";

import { useChat } from "@ai-sdk/react";
import {
  AssistantChatTransport,
  type UseChatRuntimeOptions,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useMemo } from "react";

type IndexedDBChatRuntimeOptions = Omit<
  UseChatRuntimeOptions,
  "cloud" | "transport" | "id"
> & {
  threadId: string;
  transport?: ConstructorParameters<typeof AssistantChatTransport>[0];
};

export const useIndexedDBChatRuntime = ({
  threadId,
  transport: transportOptions,
  ...chatOptions
}: IndexedDBChatRuntimeOptions) => {
  const transport = useMemo(
    () => new AssistantChatTransport(transportOptions ?? { api: "/api/chat" }),
    [transportOptions],
  );
  const chat = useChat({
    ...chatOptions,
    id: threadId,
    transport,
  });
  const runtime = useAISDKRuntime(chat);

  if (transport instanceof AssistantChatTransport) {
    transport.setRuntime(runtime);
  }

  return {
    chat,
    runtime,
  };
};
