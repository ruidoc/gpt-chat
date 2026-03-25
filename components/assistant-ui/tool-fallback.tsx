"use client";

import { Fragment, memo, useCallback, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  LoaderIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import {
  useScrollLock,
  type ToolCallMessagePartStatus,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ANIMATION_DURATION = 200;

function prettifyJsonOrRaw(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function highlightJsonLine(line: string): React.ReactNode {
  const indent = line.match(/^(\s*)/)?.[1] ?? "";
  const rest = line.slice(indent.length);
  const keyMatch = rest.match(/^("(?:[^"\\]|\\.)*")(\s*:\s*)(.*)$/);
  if (keyMatch) {
    return (
      <>
        {indent}
        <span className="text-sky-600 dark:text-sky-400">{keyMatch[1]}</span>
        {keyMatch[2]}
        <span className="text-cyan-800 dark:text-cyan-200/90">{keyMatch[3]}</span>
      </>
    );
  }
  return (
    <>
      <span className="text-zinc-600 dark:text-zinc-400">{line}</span>
    </>
  );
}

function JsonCodeBlock({ source, className }: { source: string; className?: string }) {
  const pretty = prettifyJsonOrRaw(source);
  const lines = pretty.split("\n");
  return (
    <div
      className={cn(
        "aui-tool-json-block overflow-x-auto rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/80",
        className,
      )}
    >
      <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 ? "\n" : null}
            {highlightJsonLine(line)}
          </Fragment>
        ))}
      </pre>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="aui-tool-section-label mb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
      {children}
    </p>
  );
}

export type ToolFallbackRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  "open" | "onOpenChange"
> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
};

function ToolFallbackRoot({
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  ...props
}: ToolFallbackRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        lockScroll();
      }
      if (!isControlled) {
        setUncontrolledOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  );

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="tool-fallback-root"
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn(
        "aui-tool-fallback-root group/tool-fallback-root w-full overflow-hidden rounded-xl border border-zinc-200/90 bg-card shadow-sm",
        "dark:border-zinc-800 dark:bg-zinc-950/40",
        className,
      )}
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </Collapsible>
  );
}

type ToolStatus = ToolCallMessagePartStatus["type"];

type BadgeSpec = {
  label: string;
  Icon: React.ElementType;
  badgeClass: string;
  iconClass: string;
};

function getStatusBadge(
  statusType: ToolStatus,
  isCancelled: boolean,
): BadgeSpec {
  if (isCancelled) {
    return {
      label: "Cancelled",
      Icon: XCircleIcon,
      badgeClass:
        "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400",
      iconClass: "text-zinc-500 dark:text-zinc-500",
    };
  }
  switch (statusType) {
    case "running":
      return {
        label: "Running",
        Icon: LoaderIcon,
        badgeClass:
          "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
        iconClass: "text-zinc-600 dark:text-zinc-400 animate-spin",
      };
    case "complete":
      return {
        label: "Responded",
        Icon: CheckIcon,
        badgeClass:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/35 dark:bg-blue-500/15 dark:text-blue-300",
        iconClass: "text-blue-600 dark:text-blue-400",
      };
    case "requires-action":
      return {
        label: "Awaiting Approval",
        Icon: ClockIcon,
        badgeClass:
          "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/12 dark:text-amber-200",
        iconClass: "text-amber-600 dark:text-amber-400",
      };
    case "incomplete":
      return {
        label: "Failed",
        Icon: XCircleIcon,
        badgeClass:
          "border-red-200 bg-red-50 text-red-800 dark:border-red-500/35 dark:bg-red-500/12 dark:text-red-300",
        iconClass: "text-red-600 dark:text-red-400",
      };
    default:
      return {
        label: "Pending",
        Icon: CircleIcon,
        badgeClass:
          "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400",
        iconClass: "text-zinc-500",
      };
  }
}

function ToolFallbackTrigger({
  toolName,
  status,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  toolName: string;
  status?: ToolCallMessagePartStatus;
}) {
  const statusType = status?.type ?? "complete";
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const { label, Icon, badgeClass, iconClass } = getStatusBadge(
    statusType,
    isCancelled,
  );

  return (
    <CollapsibleTrigger
      data-slot="tool-fallback-trigger"
      className={cn(
        "aui-tool-fallback-trigger flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
        "hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
        "[&[data-state=open]_.tool-chevron]:-rotate-180",
        className,
      )}
      {...props}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/90">
        <WrenchIcon
          className="size-4 text-zinc-600 dark:text-zinc-400"
          aria-hidden
        />
      </span>
      <span className="min-w-0 shrink font-mono text-[13px] text-foreground leading-none tracking-tight">
        {toolName}
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-sans text-[11px] font-medium",
          badgeClass,
          isCancelled && "line-through opacity-80",
        )}
      >
        <Icon className={cn("size-3.5 shrink-0", iconClass)} aria-hidden />
        {label}
      </span>
      <span className="min-w-2 flex-1" />
      <ChevronDownIcon
        className="tool-chevron size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out"
        aria-hidden
      />
    </CollapsibleTrigger>
  );
}

function ToolFallbackContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="tool-fallback-content"
      className={cn(
        "aui-tool-fallback-content relative overflow-hidden text-sm outline-none",
        "group/collapsible-content ease-out",
        "data-[state=closed]:animate-collapsible-up",
        "data-[state=open]:animate-collapsible-down",
        "data-[state=closed]:fill-mode-forwards",
        "data-[state=closed]:pointer-events-none",
        "data-[state=open]:duration-(--animation-duration)",
        "data-[state=closed]:duration-(--animation-duration)",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-0 border-zinc-200/80 border-t dark:border-zinc-800">
        {children}
      </div>
    </CollapsibleContent>
  );
}

function ToolFallbackArgs({
  argsText,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  argsText?: string;
}) {
  if (!argsText) return null;

  return (
    <div
      data-slot="tool-fallback-args"
      className={cn("aui-tool-fallback-args px-4 pt-4", className)}
      {...props}
    >
      <SectionLabel>Parameters</SectionLabel>
      <JsonCodeBlock source={argsText} />
    </div>
  );
}

function ToolFallbackResult({
  result,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  result?: unknown;
}) {
  if (result === undefined) return null;

  const body =
    typeof result === "string" ? result : JSON.stringify(result, null, 2);

  return (
    <div
      data-slot="tool-fallback-result"
      className={cn(
        "aui-tool-fallback-result border-zinc-200/60 border-t px-4 pt-4 dark:border-zinc-800/80",
        className,
      )}
      {...props}
    >
      <SectionLabel>Result</SectionLabel>
      <JsonCodeBlock source={body} />
    </div>
  );
}

function ToolFallbackError({
  status,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  status?: ToolCallMessagePartStatus;
}) {
  if (status?.type !== "incomplete") return null;

  const error = status.error;
  const errorText = error
    ? typeof error === "string"
      ? error
      : JSON.stringify(error)
    : null;

  if (!errorText) return null;

  const isCancelled = status.reason === "cancelled";
  const headerText = isCancelled ? "Cancelled" : "Error";

  return (
    <div
      data-slot="tool-fallback-error"
      className={cn("aui-tool-fallback-error px-4 pt-4", className)}
      {...props}
    >
      <SectionLabel>{headerText}</SectionLabel>
      <p
        className={cn(
          "rounded-lg border px-3 py-2 text-sm",
          isCancelled
            ? "border-zinc-200 bg-zinc-50 text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900/50"
            : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200",
        )}
      >
        {errorText}
      </p>
    </div>
  );
}

function ToolApprovalFooter({ toolName }: { toolName: string }) {
  return (
    <div className="flex flex-col gap-3 border-zinc-200/80 border-t px-4 py-4 dark:border-zinc-800">
      <p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
        此工具可能对系统或数据产生实际影响，执行前请确认参数无误。
        <span className="ml-1 font-mono text-foreground/80 text-xs">
          {toolName}
        </span>
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-[5.5rem] border-zinc-300 dark:border-zinc-600"
          disabled
          title="当前未接入手动审批流程；工具由运行时自动处理。"
        >
          Reject
        </Button>
        <Button
          type="button"
          size="sm"
          disabled
          title="当前未接入手动审批流程；工具由运行时自动处理。"
          className="min-w-[5.5rem] bg-blue-600 text-white hover:bg-blue-600/90 disabled:opacity-60 dark:bg-blue-600"
        >
          Accept
        </Button>
      </div>
    </div>
  );
}

const ToolFallbackImpl: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const statusType = status?.type ?? "complete";

  const defaultOpen = statusType === "requires-action";

  const rootTone = cn(
    isCancelled && "opacity-90",
    statusType === "running" &&
      "ring-1 ring-zinc-300/80 dark:ring-zinc-700",
    statusType === "requires-action" &&
      "ring-1 ring-amber-400/35 dark:ring-amber-500/25",
    statusType === "incomplete" &&
      !isCancelled &&
      "ring-1 ring-red-300/50 dark:ring-red-500/20",
  );

  return (
    <ToolFallbackRoot
      defaultOpen={defaultOpen}
      className={cn("mb-3", rootTone)}
    >
      <ToolFallbackTrigger toolName={toolName} status={status} />
      <ToolFallbackContent>
        <ToolFallbackError status={status} />
        <ToolFallbackArgs
          argsText={argsText}
          className={cn(isCancelled && "opacity-60")}
        />
        {statusType === "requires-action" ? (
          <ToolApprovalFooter toolName={toolName} />
        ) : null}
        {!isCancelled && <ToolFallbackResult result={result} />}
      </ToolFallbackContent>
    </ToolFallbackRoot>
  );
};

const ToolFallback = memo(
  ToolFallbackImpl,
) as unknown as ToolCallMessagePartComponent & {
  Root: typeof ToolFallbackRoot;
  Trigger: typeof ToolFallbackTrigger;
  Content: typeof ToolFallbackContent;
  Args: typeof ToolFallbackArgs;
  Result: typeof ToolFallbackResult;
  Error: typeof ToolFallbackError;
};

ToolFallback.displayName = "ToolFallback";
ToolFallback.Root = ToolFallbackRoot;
ToolFallback.Trigger = ToolFallbackTrigger;
ToolFallback.Content = ToolFallbackContent;
ToolFallback.Args = ToolFallbackArgs;
ToolFallback.Result = ToolFallbackResult;
ToolFallback.Error = ToolFallbackError;

export {
  ToolFallback,
  ToolFallbackRoot,
  ToolFallbackTrigger,
  ToolFallbackContent,
  ToolFallbackArgs,
  ToolFallbackResult,
  ToolFallbackError,
};
