"use client";

import { AssistantSidebar } from "@/components/assistant-ui/assistant-sidebar";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  createThreadId,
  type StoredThreadSummary,
} from "@/lib/chat-thread-store";
import {
  deleteRemoteThread,
  listRemoteThreads,
  loadRemoteThreadMessages,
} from "@/lib/remote-chat-store";
import { useIndexedDBChatRuntime } from "@/lib/use-indexeddb-chat-runtime";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { BrainIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MODEL_OPTIONS = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    description: "New API",
    icon: <BrainIcon />,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    description: "New API",
    icon: <BrainIcon />,
  },
];

function getThreadIdFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const match = window.location.pathname.match(/^\/chat\/([^/]+)/);
  return match?.[1] || undefined;
}

type AssistantProps = {
  initialThreadId?: string;
  currentUserLabel: string;
};

export const Assistant = ({
  initialThreadId,
  currentUserLabel,
}: AssistantProps) => {
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(
    initialThreadId,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("gpt-chat-sidebar") === "collapsed";
  });
  const [threads, setThreads] = useState<StoredThreadSummary[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [draftThreadId, setDraftThreadId] = useState(() => createThreadId());
  const [hydrating, setHydrating] = useState(!!initialThreadId);
  const hydratingRef = useRef(!!initialThreadId);
  const didFinalizeDraftRef = useRef(false);

  const transport = useMemo(() => ({ api: "/api/chat" }), []);

  useEffect(() => {
    window.localStorage.setItem(
      "gpt-chat-sidebar",
      sidebarCollapsed ? "collapsed" : "expanded",
    );
  }, [sidebarCollapsed]);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const id = getThreadIdFromUrl();
      setActiveThreadId(id);
      didFinalizeDraftRef.current = !!id;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const { chat, runtime } = useIndexedDBChatRuntime({
    threadId: activeThreadId ?? draftThreadId,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });
  const { messages, setMessages, status } = chat;

  const refreshThreads = useCallback(async () => {
    const nextThreads = await listRemoteThreads();
    setThreads(nextThreads);
    setThreadsLoaded(true);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshThreads();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshThreads]);

  // Load messages when activeThreadId changes
  useEffect(() => {
    hydratingRef.current = true;

    if (!activeThreadId) {
      setMessages([]);
      hydratingRef.current = false;
      const clearHydratingTimer = window.setTimeout(() => {
        setHydrating(false);
      }, 0);

      return () => window.clearTimeout(clearHydratingTimer);
    }

    const startHydratingTimer = window.setTimeout(() => {
      setHydrating(true);
    }, 0);
    let finishHydratingTimer: number | undefined;
    let cancelled = false;

    void loadRemoteThreadMessages(activeThreadId)
      .then((msgs) => {
        if (!cancelled) {
          setMessages(msgs);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
        }
      })
      .finally(() => {
        hydratingRef.current = false;
        finishHydratingTimer = window.setTimeout(() => {
          if (!cancelled) {
            setHydrating(false);
          }
        }, 0);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(startHydratingTimer);
      if (finishHydratingTimer) {
        window.clearTimeout(finishHydratingTimer);
      }
    };
  }, [setMessages, activeThreadId]);

  useEffect(() => {
    if (hydratingRef.current || status !== "ready") {
      return;
    }

    const hasAssistantReply = messages.some(
      (message) =>
        message.role === "assistant" &&
        message.parts.some(
          (part) =>
            (part.type === "text" && (part.text?.trim().length ?? 0) > 0) ||
            part.type === "reasoning" ||
            part.type === "tool-call",
        ),
    );

    if (!hasAssistantReply) {
      return;
    }

    const refreshTimer = window.setTimeout(() => {
      void refreshThreads();
    }, 0);
    let activateDraftTimer: number | undefined;

    if (!activeThreadId && !didFinalizeDraftRef.current) {
      didFinalizeDraftRef.current = true;
      activateDraftTimer = window.setTimeout(() => {
        setActiveThreadId(draftThreadId);
        window.history.replaceState(null, "", `/chat/${draftThreadId}`);
      }, 0);
    }

    return () => {
      window.clearTimeout(refreshTimer);
      if (activateDraftTimer) {
        window.clearTimeout(activateDraftTimer);
      }
    };
  }, [activeThreadId, draftThreadId, messages, refreshThreads, status]);

  const effectiveThreadId = activeThreadId ?? draftThreadId;

  const handleSelectThread = useCallback(
    (nextThreadId: string) => {
      if (nextThreadId === effectiveThreadId) return;
      didFinalizeDraftRef.current = true;
      setActiveThreadId(nextThreadId);
      window.history.pushState(null, "", `/chat/${nextThreadId}`);
    },
    [effectiveThreadId],
  );

  const handleNewThread = useCallback(() => {
    const nextDraftThreadId = createThreadId();
    didFinalizeDraftRef.current = false;
    setDraftThreadId(nextDraftThreadId);
    setActiveThreadId(undefined);
    setMessages([]);
    window.history.pushState(null, "", "/chat");
  }, [setMessages]);

  const handleDeleteThread = useCallback(
    async (targetThreadId: string) => {
      await deleteRemoteThread(targetThreadId);
      await refreshThreads();

      if (targetThreadId === effectiveThreadId) {
        didFinalizeDraftRef.current = false;
        setDraftThreadId(createThreadId());
        setActiveThreadId(undefined);
        setMessages([]);
        window.history.replaceState(null, "", "/chat");
      }
    },
    [effectiveThreadId, refreshThreads, setMessages],
  );

  const handleLogout = useCallback(async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login";
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TooltipProvider>
        <AssistantSidebar
          currentUserLabel={currentUserLabel}
          modelOptions={MODEL_OPTIONS}
          sidebarCollapsed={sidebarCollapsed}
          hydrating={hydrating}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        >
          <ThreadList
            activeThreadId={effectiveThreadId}
            isLoading={!threadsLoaded}
            threads={threads}
            onDeleteThread={handleDeleteThread}
            onNewThread={handleNewThread}
            onSelectThread={handleSelectThread}
          />
        </AssistantSidebar>
      </TooltipProvider>
    </AssistantRuntimeProvider>
  );
};
