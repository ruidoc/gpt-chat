"use client";

import type { UIMessage } from "ai";

import { createIndexedDBStorage } from "@/lib/indexeddb-storage";

export type StoredThreadSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

type StoredThreadRecord = StoredThreadSummary & {
  messages: UIMessage[];
};

const storage = createIndexedDBStorage({
  dbName: "gpt-chat",
  storeName: "assistant-ui",
});

const THREADS_INDEX_KEY = "@gpt-chat:simple-threads";
const getThreadKey = (id: string) => `@gpt-chat:simple-thread:${id}`;

const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
  const raw = await storage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown) => {
  await storage.setItem(key, JSON.stringify(value));
};

const deriveTitle = (messages: UIMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const firstTextPart = firstUserMessage?.parts?.find((part) => part.type === "text");

  const title =
    firstTextPart && "text" in firstTextPart
      ? firstTextPart.text?.trim().replace(/\s+/g, " ")
      : undefined;
  return title?.slice(0, 40) || "新聊天";
};

export const createThreadId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

export const listStoredThreads = async (): Promise<StoredThreadSummary[]> => {
  const threads = await readJson<StoredThreadSummary[]>(THREADS_INDEX_KEY, []);
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
};

export const loadStoredThreadMessages = async (
  threadId: string,
): Promise<UIMessage[]> => {
  const record = await readJson<StoredThreadRecord | null>(
    getThreadKey(threadId),
    null,
  );

  return record?.messages ?? [];
};

export const saveStoredThreadMessages = async (
  threadId: string,
  messages: UIMessage[],
) => {
  if (messages.length === 0) return;

  const currentRecord = await readJson<StoredThreadRecord | null>(
    getThreadKey(threadId),
    null,
  );
  const createdAt = currentRecord?.createdAt ?? Date.now();
  const updatedAt = Date.now();
  const title = deriveTitle(messages);

  const record: StoredThreadRecord = {
    id: threadId,
    title,
    createdAt,
    updatedAt,
    messages,
  };

  await writeJson(getThreadKey(threadId), record);

  const threads = await listStoredThreads();
  const nextThreads = [
    record,
    ...threads.filter((thread) => thread.id !== threadId),
  ].map(({ id, title: itemTitle, createdAt: itemCreatedAt, updatedAt: itemUpdatedAt }) => ({
    id,
    title: itemTitle,
    createdAt: itemCreatedAt,
    updatedAt: itemUpdatedAt,
  }));

  await writeJson(THREADS_INDEX_KEY, nextThreads);
};

export const deleteStoredThread = async (threadId: string) => {
  await storage.removeItem(getThreadKey(threadId));

  const threads = await listStoredThreads();
  await writeJson(
    THREADS_INDEX_KEY,
    threads.filter((thread) => thread.id !== threadId),
  );
};
