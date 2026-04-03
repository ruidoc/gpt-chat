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
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        ...transportOptions,
        prepareSendMessagesRequest: async (options) => {
          const preparedRequest =
            await transportOptions?.prepareSendMessagesRequest?.(options);
          const preparedBody =
            preparedRequest?.body &&
            typeof preparedRequest.body === "object" &&
            !Array.isArray(preparedRequest.body)
              ? preparedRequest.body
              : {};

          return {
            ...preparedRequest,
            body: {
              ...options.body,
              ...preparedBody,
              messages: options.messages,
              trigger: options.trigger,
              messageId: options.messageId,
              metadata: options.requestMetadata,
              id: threadId,
            },
          };
        },
      }),
    [threadId, transportOptions],
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
