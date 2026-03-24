"use client";

import { RuntimeAdapterProvider, type ExportedMessageRepository, type ExportedMessageRepositoryItem, type GenericThreadHistoryAdapter, type MessageFormatAdapter, type MessageStorageEntry, type RemoteThreadListAdapter, type ThreadHistoryAdapter, type ThreadMessage, useAui } from "@assistant-ui/react";
import { type FC, type PropsWithChildren, useMemo } from "react";

import type { AsyncStorageLike } from "@/lib/indexeddb-storage";

type IndexedDBThreadListAdapterOptions = {
  storage: AsyncStorageLike;
  prefix?: string;
};

type StoredThreadMetadata = {
  remoteId: string;
  externalId?: string;
  status: "regular" | "archived";
  title?: string;
};

type StoredFormattedRepository<TStorageFormat extends Record<string, unknown>> = {
  headId?: string | null;
  messages: MessageStorageEntry<TStorageFormat>[];
};

const createThreadHashId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

class IndexedDBHistoryAdapter implements ThreadHistoryAdapter {
  constructor(
    private readonly storage: AsyncStorageLike,
    private readonly aui: ReturnType<typeof useAui>,
    private readonly prefix: string,
  ) {}

  private getMessagesKey(remoteId: string) {
    return `${this.prefix}messages:${remoteId}`;
  }

  private getFormattedMessagesKey(remoteId: string, format: string) {
    return `${this.prefix}formatted-messages:${format}:${remoteId}`;
  }

  async load(): Promise<ExportedMessageRepository> {
    const remoteId = this.aui.threadListItem().getState().remoteId;
    if (!remoteId) return { messages: [] };

    const raw = await this.storage.getItem(this.getMessagesKey(remoteId));
    if (!raw) return { messages: [] };

    return JSON.parse(raw) as ExportedMessageRepository;
  }

  async append(item: ExportedMessageRepositoryItem): Promise<void> {
    const { remoteId } = await this.aui.threadListItem().initialize();
    const key = this.getMessagesKey(remoteId);
    const raw = await this.storage.getItem(key);
    const repository: ExportedMessageRepository = raw
      ? (JSON.parse(raw) as ExportedMessageRepository)
      : { messages: [] };

    const existingIndex = repository.messages.findIndex(
      (message) => message.message.id === item.message.id,
    );

    if (existingIndex >= 0) {
      repository.messages[existingIndex] = item;
    } else {
      repository.messages.push(item);
    }

    repository.headId = item.message.id;

    await this.storage.setItem(key, JSON.stringify(repository));
  }

  withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ): GenericThreadHistoryAdapter<TMessage> {
    const loadRepository = async (remoteId: string) => {
      const key = this.getFormattedMessagesKey(remoteId, formatAdapter.format);
      const raw = await this.storage.getItem(key);
      const repository: StoredFormattedRepository<TStorageFormat> = raw
        ? (JSON.parse(raw) as StoredFormattedRepository<TStorageFormat>)
        : { messages: [] };

      return { key, repository };
    };

    const saveRepository = async (
      key: string,
      repository: StoredFormattedRepository<TStorageFormat>,
    ) => {
      await this.storage.setItem(key, JSON.stringify(repository));
    };

    return {
      load: async () => {
        const remoteId = this.aui.threadListItem().getState().remoteId;
        if (!remoteId) return { messages: [] };

        const { repository } = await loadRepository(remoteId);

        return {
          headId: repository.headId,
          messages: repository.messages.map((message) =>
            formatAdapter.decode(message),
          ),
        };
      },

      append: async (item) => {
        const { remoteId } = await this.aui.threadListItem().initialize();
        const { key, repository } = await loadRepository(remoteId);
        const messageId = formatAdapter.getId(item.message);
        const storedEntry: MessageStorageEntry<TStorageFormat> = {
          id: messageId,
          parent_id: item.parentId,
          format: formatAdapter.format,
          content: formatAdapter.encode(item),
        };

        const existingIndex = repository.messages.findIndex(
          (message) => message.id === messageId,
        );

        if (existingIndex >= 0) {
          repository.messages[existingIndex] = storedEntry;
        } else {
          repository.messages.push(storedEntry);
        }

        repository.headId = messageId;
        await saveRepository(key, repository);
      },

      update: async (item, localMessageId) => {
        const { remoteId } = await this.aui.threadListItem().initialize();
        const { key, repository } = await loadRepository(remoteId);
        const storedEntry: MessageStorageEntry<TStorageFormat> = {
          id: localMessageId,
          parent_id: item.parentId,
          format: formatAdapter.format,
          content: formatAdapter.encode(item),
        };

        const existingIndex = repository.messages.findIndex(
          (message) => message.id === localMessageId,
        );

        if (existingIndex >= 0) {
          repository.messages[existingIndex] = storedEntry;
        } else {
          repository.messages.push(storedEntry);
        }

        repository.headId = localMessageId;
        await saveRepository(key, repository);
      },
    };
  }
}

const getThreadTitleFromMessages = (messages: readonly ThreadMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "新聊天";

  const firstTextPart = firstUserMessage.content.find(
    (
      part,
    ): part is Extract<(typeof firstUserMessage.content)[number], { type: "text" }> =>
      part.type === "text",
  );

  const title = firstTextPart?.text?.trim().replace(/\s+/g, " ");
  if (!title) return "新聊天";

  return title.slice(0, 40);
};

const createHistoryProvider = (
  storage: AsyncStorageLike,
  prefix: string,
): FC<PropsWithChildren> => {
  const Provider: FC<PropsWithChildren> = ({ children }) => {
    const aui = useAui();
    const history = useMemo(
      () => new IndexedDBHistoryAdapter(storage, aui, prefix),
      [aui],
    );
    const adapters = useMemo(() => ({ history }), [history]);

    return (
      <RuntimeAdapterProvider adapters={adapters}>
        {children}
      </RuntimeAdapterProvider>
    );
  };

  return Provider;
};

export function createIndexedDBThreadListAdapter({
  storage,
  prefix = "@gpt-chat:",
}: IndexedDBThreadListAdapterOptions): RemoteThreadListAdapter {
  const threadsKey = `${prefix}threads`;
  const messagesKey = (threadId: string) => `${prefix}messages:${threadId}`;

  const loadThreadMetadata = async (): Promise<StoredThreadMetadata[]> => {
    const raw = await storage.getItem(threadsKey);
    return raw ? (JSON.parse(raw) as StoredThreadMetadata[]) : [];
  };

  const saveThreadMetadata = async (threads: StoredThreadMetadata[]) => {
    await storage.setItem(threadsKey, JSON.stringify(threads));
  };

  const adapter: RemoteThreadListAdapter = {
    unstable_Provider: createHistoryProvider(storage, prefix),

    async list() {
      const threads = await loadThreadMetadata();

      return {
        threads: threads.map((thread) => ({
          remoteId: thread.remoteId,
          externalId: thread.externalId,
          status: thread.status,
          title: thread.title,
        })),
      };
    },

    async initialize(threadId: string) {
      const remoteId = threadId.startsWith("__LOCALID_")
        ? createThreadHashId()
        : threadId;
      const threads = await loadThreadMetadata();

      if (!threads.some((thread) => thread.remoteId === remoteId)) {
        threads.unshift({
          remoteId,
          status: "regular",
        });
        await saveThreadMetadata(threads);
      }

      return { remoteId, externalId: undefined };
    },

    async rename(remoteId: string, newTitle: string) {
      const threads = await loadThreadMetadata();
      const thread = threads.find((item) => item.remoteId === remoteId);

      if (thread) {
        thread.title = newTitle;
        await saveThreadMetadata(threads);
      }
    },

    async archive(remoteId: string) {
      const threads = await loadThreadMetadata();
      const thread = threads.find((item) => item.remoteId === remoteId);

      if (thread) {
        thread.status = "archived";
        await saveThreadMetadata(threads);
      }
    },

    async unarchive(remoteId: string) {
      const threads = await loadThreadMetadata();
      const thread = threads.find((item) => item.remoteId === remoteId);

      if (thread) {
        thread.status = "regular";
        await saveThreadMetadata(threads);
      }
    },

    async delete(remoteId: string) {
      const threads = await loadThreadMetadata();
      const filteredThreads = threads.filter((thread) => thread.remoteId !== remoteId);

      await saveThreadMetadata(filteredThreads);
      await storage.removeItem(messagesKey(remoteId));
    },

    async fetch(threadId: string) {
      const threads = await loadThreadMetadata();
      const thread = threads.find((item) => item.remoteId === threadId);

      if (!thread) {
        throw new Error("Thread not found.");
      }

      return {
        remoteId: thread.remoteId,
        externalId: thread.externalId,
        status: thread.status,
        title: thread.title,
      };
    },

    async generateTitle(
      remoteId: string,
      messages: readonly ThreadMessage[],
    ) {
      const title = getThreadTitleFromMessages(messages);
      const threads = await loadThreadMetadata();
      const thread = threads.find((item) => item.remoteId === remoteId);

      if (thread) {
        thread.title = title;
        await saveThreadMetadata(threads);
      }

      return new ReadableStream({
        start(controller) {
          controller.enqueue({
            path: [0],
            type: "part-start",
            part: { type: "text" },
          });
          controller.enqueue({
            path: [0],
            type: "text-delta",
            textDelta: title,
          });
          controller.enqueue({
            path: [0],
            type: "part-finish",
          });
          controller.close();
        },
      });
    },
  };

  return adapter;
}
