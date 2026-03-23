"use client";

import { AssistantSidebar, type ModelOption } from "@/components/assistant-ui/assistant-sidebar";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useEffect, useMemo, useState } from "react";

const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "doubao-seed-1-6-flash-250828",
    label: "Doubao 1.6 Flash",
  },
];

export const Assistant = () => {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modelName, setModelName] = useState(MODEL_OPTIONS[0].value);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("gpt-chat-theme");
    const savedSidebar = window.localStorage.getItem("gpt-chat-sidebar");
    const savedModel = window.localStorage.getItem("gpt-chat-model");

    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    if (savedSidebar === "collapsed") {
      setSidebarCollapsed(true);
    }

    if (savedModel && MODEL_OPTIONS.some((option) => option.value === savedModel)) {
      setModelName(savedModel);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("gpt-chat-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(
      "gpt-chat-sidebar",
      sidebarCollapsed ? "collapsed" : "expanded",
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    window.localStorage.setItem("gpt-chat-model", modelName);
  }, [modelName]);

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        body: {
          modelName,
        },
      }),
    [modelName],
  );

  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TooltipProvider>
        <AssistantSidebar
          modelName={modelName}
          modelOptions={MODEL_OPTIONS}
          onModelChange={setModelName}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          theme={theme}
          onToggleTheme={() =>
            setTheme((value) => (value === "dark" ? "light" : "dark"))
          }
        >
          <div className="h-full bg-muted/30 p-2">
            <ThreadList />
          </div>
        </AssistantSidebar>
      </TooltipProvider>
    </AssistantRuntimeProvider>
  );
};
