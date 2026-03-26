"use client";

import { Fragment, memo, useCallback, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleCheckBigIcon,
  CircleIcon,
  ClockIcon,
  LoaderIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import {
  useAuiState,
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
  iconClass: string;
};

const BADGE_BASE_CLASS =
  "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400";

/** Softer warning tone for tool failures (not alarm red). */
const FAILED_ICON_CLASS =
  "text-amber-700/85 dark:text-amber-400/95";
const FAILED_CALLOUT_CLASS =
  "border-amber-200/90 bg-amber-50/90 text-amber-950 dark:border-amber-500/22 dark:bg-amber-500/[0.09] dark:text-amber-100/95";

/** When the whole chain ended in failure: last tool uses strong red “Error”. */
const ERROR_ICON_CLASS = "text-red-600 dark:text-red-400";
const ERROR_CALLOUT_CLASS =
  "border-red-200 bg-red-50 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200";

const COMPLETED_ICON_CLASS =
  "text-emerald-600 dark:text-emerald-400";

type MessagePartLike = { type?: string; toolCallId?: string };

type ToolCallPartState = MessagePartLike & {
  isError?: boolean;
  result?: unknown;
  status?: ToolCallMessagePartStatus;
};

function partIsTerminalFailedTool(p: unknown): boolean {
  const part = p as ToolCallPartState;
  if (part.type !== "tool-call") return false;
  if (part.isError) return true;
  const st = part.status?.type;
  if (st === "incomplete") {
    return part.status?.reason !== "cancelled";
  }
  if (st === "complete") {
    return toolOutputHasError(part.result);
  }
  return false;
}

/** Last `tool-call` in this assistant message (text/reasoning may follow). */
function useIsLastToolCallInMessage(toolCallId: string | undefined): boolean {
  return useAuiState((s) => {
    if (!toolCallId) return false;
    const { parts } = s.message;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i] as MessagePartLike;
      if (p.type === "tool-call") {
        return p.toolCallId === toolCallId;
      }
    }
    return false;
  });
}

function useFinalSuccessfulToolCallUi(
  toolCallId: string | undefined,
  statusType: ToolStatus,
  outputHasError: boolean,
  isCancelled: boolean,
): boolean {
  const isLastToolCall = useIsLastToolCallInMessage(toolCallId);
  const turnFinished = useAuiState((s) => !s.thread.isRunning);
  return (
    isLastToolCall &&
    turnFinished &&
    statusType === "complete" &&
    !outputHasError &&
    !isCancelled
  );
}

/** Turn finished, every tool call in this message failed, and this is the last one → red Error. */
function useFinalAllFailedChainErrorUi(
  toolCallId: string | undefined,
  isCancelled: boolean,
  statusType: ToolStatus,
  outputHasError: boolean,
): boolean {
  return useAuiState((s) => {
    if (!toolCallId || isCancelled || s.thread.isRunning) return false;
    const currentFailed =
      (statusType === "complete" && outputHasError) ||
      (statusType === "incomplete" && !isCancelled);
    if (!currentFailed) return false;

    const { parts } = s.message;
    let lastToolId: string | undefined;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i] as ToolCallPartState;
      if (p.type === "tool-call") {
        lastToolId = p.toolCallId;
        break;
      }
    }
    if (lastToolId !== toolCallId) return false;

    const toolParts = parts.filter(
      (p) => (p as ToolCallPartState).type === "tool-call",
    );
    return (
      toolParts.length > 0 && toolParts.every((p) => partIsTerminalFailedTool(p))
    );
  });
}

/** Tool returned `{ error: ... }` (or transport mapped it onto `result`) — surface as Failed, not success. */
function toolOutputHasError(result: unknown): boolean {
  if (result === null || result === undefined) return false;
  if (typeof result !== "object") return false;
  if (!("error" in result)) return false;
  const err = (result as { error?: unknown }).error;
  if (err === undefined || err === null) return false;
  if (typeof err === "string") return err.trim().length > 0;
  return true;
}

function getStatusBadge(
  statusType: ToolStatus,
  isCancelled: boolean,
  outputHasError: boolean,
  isFinalSuccessfulToolCall: boolean,
  isFinalAllFailedErrorChain: boolean,
): BadgeSpec {
  if (isCancelled) {
    return {
      label: "Cancelled",
      Icon: XCircleIcon,
      iconClass: "text-zinc-500 dark:text-zinc-500",
    };
  }
  if (isFinalAllFailedErrorChain) {
    return {
      label: "Error",
      Icon: XCircleIcon,
      iconClass: ERROR_ICON_CLASS,
    };
  }
  if (outputHasError && statusType === "complete") {
    return {
      label: "Failed",
      Icon: XCircleIcon,
      iconClass: FAILED_ICON_CLASS,
    };
  }
  if (isFinalSuccessfulToolCall) {
    return {
      label: "Completed",
      Icon: CircleCheckBigIcon,
      iconClass: COMPLETED_ICON_CLASS,
    };
  }
  switch (statusType) {
    case "running":
      return {
        label: "Running",
        Icon: LoaderIcon,
        iconClass: "text-zinc-600 dark:text-zinc-400 animate-spin",
      };
    case "complete":
      return {
        label: "Responded",
        Icon: CheckIcon,
        iconClass: "text-blue-600 dark:text-blue-400",
      };
    case "requires-action":
      return {
        label: "Awaiting Approval",
        Icon: ClockIcon,
        iconClass: "text-amber-600 dark:text-amber-400",
      };
    case "incomplete":
      return {
        label: "Failed",
        Icon: XCircleIcon,
        iconClass: FAILED_ICON_CLASS,
      };
    default:
      return {
        label: "Pending",
        Icon: CircleIcon,
        iconClass: "text-zinc-500 dark:text-zinc-400",
      };
  }
}

function ToolFallbackTrigger({
  toolName,
  status,
  result,
  isFinalSuccessfulToolCall,
  isFinalAllFailedErrorChain,
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  toolName: string;
  status?: ToolCallMessagePartStatus;
  result?: unknown;
  isFinalSuccessfulToolCall?: boolean;
  isFinalAllFailedErrorChain?: boolean;
}) {
  const statusType = status?.type ?? "complete";
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const outputHasError = toolOutputHasError(result);
  const { label, Icon, iconClass } = getStatusBadge(
    statusType,
    isCancelled,
    outputHasError,
    Boolean(isFinalSuccessfulToolCall),
    Boolean(isFinalAllFailedErrorChain),
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
      <span className="flex shrink-0 items-center justify-center">
        <WrenchIcon
          className="size-4 text-zinc-600 dark:text-zinc-400"
          aria-hidden
        />
      </span>
      <span className="min-w-0 shrink font-mono text-[14px] text-foreground leading-none tracking-tight">
        {toolName}
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-0.5 font-sans text-[12px] font-medium",
          BADGE_BASE_CLASS,
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
      className={cn("aui-tool-fallback-args px-4 py-4", className)}
      {...props}
    >
      <SectionLabel>Parameters</SectionLabel>
      <JsonCodeBlock source={argsText} />
    </div>
  );
}

function ToolFallbackResult({
  result,
  isFinalAllFailedErrorChain,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  result?: unknown;
  isFinalAllFailedErrorChain?: boolean;
}) {
  if (result === undefined) return null;

  const failed = toolOutputHasError(result);
  const body =
    typeof result === "string" ? result : JSON.stringify(result);

  return (
    <div
      data-slot="tool-fallback-result"
      className={cn(
        "aui-tool-fallback-result border-zinc-200/60 border-t px-4 py-4 dark:border-zinc-800/80",
        className,
      )}
      {...props}
    >
      <SectionLabel>
        {failed
          ? isFinalAllFailedErrorChain
            ? "Error"
            : "Failed"
          : "Result"}
      </SectionLabel>
      <div
        className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/80"
      >
        <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-zinc-700 dark:text-zinc-300">
          {body}
        </pre>
      </div>
    </div>
  );
}

function ToolFallbackError({
  status,
  isFinalAllFailedErrorChain,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  status?: ToolCallMessagePartStatus;
  isFinalAllFailedErrorChain?: boolean;
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
  const headerText = isCancelled
    ? "Cancelled"
    : isFinalAllFailedErrorChain
      ? "Error"
      : "Failed";

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
            : isFinalAllFailedErrorChain
              ? ERROR_CALLOUT_CLASS
              : FAILED_CALLOUT_CLASS,
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
  toolCallId,
}) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const statusType = status?.type ?? "complete";
  const outputHasError = toolOutputHasError(result);
  const isFinalSuccessfulToolCall = useFinalSuccessfulToolCallUi(
    typeof toolCallId === "string" ? toolCallId : undefined,
    statusType,
    outputHasError,
    isCancelled,
  );
  const isFinalAllFailedErrorChain = useFinalAllFailedChainErrorUi(
    typeof toolCallId === "string" ? toolCallId : undefined,
    isCancelled,
    statusType,
    outputHasError,
  );

  const defaultOpen = statusType === "requires-action";

  return (
    <ToolFallbackRoot
      defaultOpen={defaultOpen}
      className={cn("mb-3", isCancelled && "opacity-90")}
    >
      <ToolFallbackTrigger
        toolName={toolName}
        status={status}
        result={result}
        isFinalSuccessfulToolCall={isFinalSuccessfulToolCall}
        isFinalAllFailedErrorChain={isFinalAllFailedErrorChain}
      />
      <ToolFallbackContent>
        <ToolFallbackError
          status={status}
          isFinalAllFailedErrorChain={isFinalAllFailedErrorChain}
        />
        <ToolFallbackArgs
          argsText={argsText}
          className={cn(isCancelled && "opacity-60")}
        />
        {statusType === "requires-action" ? (
          <ToolApprovalFooter toolName={toolName} />
        ) : null}
        {!isCancelled && (
          <ToolFallbackResult
            result={result}
            isFinalAllFailedErrorChain={isFinalAllFailedErrorChain}
          />
        )}
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
