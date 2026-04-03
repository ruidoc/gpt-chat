"use client";

import type { UIMessage } from "ai";

import type { StoredThreadSummary } from "@/lib/chat-thread-store";

const redirectToLogin = () => {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
};

const fetchJson = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
  });

  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? payload.error || "Request failed."
        : "Request failed.",
    );
  }

  return payload as T;
};

export const listRemoteThreads = async (): Promise<StoredThreadSummary[]> => {
  const payload = await fetchJson<{ threads: StoredThreadSummary[] }>("/api/threads");
  return payload.threads;
};

export const loadRemoteThreadMessages = async (
  threadId: string,
): Promise<UIMessage[]> => {
  const payload = await fetchJson<{ messages: UIMessage[] }>(
    `/api/threads/${encodeURIComponent(threadId)}/messages`,
  );

  return payload.messages;
};

export const deleteRemoteThread = async (threadId: string) => {
  await fetchJson<{ ok: true }>(`/api/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
  });
};
