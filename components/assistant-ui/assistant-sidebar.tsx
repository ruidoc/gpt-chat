import {
  ModelSelector,
  type ModelOption,
} from "@/components/assistant-ui/model-selector";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Thread } from "@/components/assistant-ui/thread";
import { cn } from "@/lib/utils";
import { ChartNoAxesCombinedIcon, PanelLeftIcon, ShareIcon } from "lucide-react";
import Link from "next/link";
import type { FC, PropsWithChildren } from "react";

type AssistantSidebarProps = PropsWithChildren<{
  sidebarCollapsed: boolean;
  hydrating?: boolean;
  onToggleSidebar: () => void;
  modelOptions: ModelOption[];
}>;

export const AssistantSidebar: FC<AssistantSidebarProps> = ({
  children,
  sidebarCollapsed,
  hydrating,
  onToggleSidebar,
  modelOptions,
}) => {
  return (
    <div className="h-dvh bg-background">
      <div className="flex h-full">
        <aside
          className={cn(
            "flex h-full flex-col bg-muted/30 transition-all duration-200",
            sidebarCollapsed
              ? "w-0 overflow-hidden opacity-0"
              : "w-[16.25rem] opacity-100"
          )}
        >
          <div className="flex h-14 shrink-0 items-center px-4">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <ChartNoAxesCombinedIcon className="size-6 text-indigo-400" strokeWidth={2.2} />
              <span className="font-[family-name:var(--font-sora)] text-[18px] font-semibold tracking-tight text-foreground pt-1">DataTalk</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 px-4">
            <TooltipIconButton
              variant="ghost"
              size="icon"
              tooltip={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              side="bottom"
              onClick={onToggleSidebar}
              className="size-9"
            >
              <PanelLeftIcon className="size-4" />
            </TooltipIconButton>

            <ModelSelector
              models={modelOptions}
              defaultValue={modelOptions[0]?.id}
              variant="outline"
              size="default"
            />

            <TooltipIconButton
              variant="ghost"
              size="icon"
              tooltip="Share"
              side="bottom"
              className="ml-auto size-9"
            >
              <ShareIcon className="size-4" />
            </TooltipIconButton>
          </header>

          <div className="min-h-0 flex-1">
            <Thread hydrating={hydrating} />
          </div>
        </section>
      </div>
    </div>
  );
};
