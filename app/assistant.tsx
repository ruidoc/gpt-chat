"use client";

import { AssistantSidebar } from "@/components/assistant-ui/assistant-sidebar";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { BrainIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MODEL_OPTIONS = [
  {
    id: "doubao-seed-1-6-flash-250828",
    name: "Doubao 1.6 Flash",
    description: "Volcengine Ark",
    icon: <BrainIcon />,
  },
];

export const Assistant = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedSidebar = window.localStorage.getItem("gpt-chat-sidebar");

    if (savedSidebar === "collapsed") {
      setSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "gpt-chat-sidebar",
      sidebarCollapsed ? "collapsed" : "expanded",
    );
  }, [sidebarCollapsed]);

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
      }),
    [],
  );

  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TooltipProvider>
        <AssistantSidebar
          modelOptions={MODEL_OPTIONS}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        >
          <ThreadList />
        </AssistantSidebar>
      </TooltipProvider>
    </AssistantRuntimeProvider>
  );
};
