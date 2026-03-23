import { Thread } from "@/components/assistant-ui/thread";
import { Button } from "@/components/ui/button";
import {
  ChevronsUpDownIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SunIcon,
} from "lucide-react";
import type { FC, PropsWithChildren } from "react";

export type ModelOption = {
  value: string;
  label: string;
};

type AssistantSidebarProps = PropsWithChildren<{
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  modelName: string;
  modelOptions: ModelOption[];
  onModelChange: (value: string) => void;
}>;

export const AssistantSidebar: FC<AssistantSidebarProps> = ({
  children,
  sidebarCollapsed,
  onToggleSidebar,
  theme,
  onToggleTheme,
  modelName,
  modelOptions,
  onModelChange,
}) => {
  return (
    <div className="h-dvh bg-background">
      <div className="flex h-full">
        {!sidebarCollapsed ? (
          <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar">
            {children}
          </aside>
        ) : null}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b px-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onToggleSidebar}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpenIcon className="size-4" />
                ) : (
                  <PanelLeftCloseIcon className="size-4" />
                )}
              </Button>

              <div className="relative">
                <select
                  value={modelName}
                  onChange={(event) => onModelChange(event.target.value)}
                  aria-label="Select model"
                  className="h-9 appearance-none rounded-full border bg-background pl-4 pr-9 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onToggleTheme}
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <SunIcon className="size-4" />
              ) : (
                <MoonIcon className="size-4" />
              )}
            </Button>
          </header>

          <div className="min-h-0 flex-1">
            <Thread />
          </div>
        </section>
      </div>
    </div>
  );
};
