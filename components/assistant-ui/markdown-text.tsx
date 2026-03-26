"use client";

import "@assistant-ui/react-markdown/styles/dot.css";
import "streamdown/styles.css";

import { INTERNAL, useMessagePartText } from "@assistant-ui/react";
import { code } from "@streamdown/code";
import { Streamdown, type Components } from "streamdown";
import {
  forwardRef,
  memo,
  type ComponentProps,
  type CSSProperties,
} from "react";

import {
  type MarkdownHeadingFontSizes,
  MARKDOWN_HEADING_FONT_SIZES,
  STREAMDOWN_TABLE_USE_WRAPPER,
} from "@/lib/chat-markdown-config";
import { cn } from "@/lib/utils";

const { useSmooth, useSmoothStatus, withSmoothContextProvider } = INTERNAL;

function mergeHeadingStyle(
  level: keyof MarkdownHeadingFontSizes,
  style?: CSSProperties,
): CSSProperties | undefined {
  const fs = MARKDOWN_HEADING_FONT_SIZES[level];
  if (!fs && !style) return undefined;
  return { ...style, ...(fs ? { fontSize: fs } : {}) };
}

const SimpleTable: NonNullable<Components["table"]> = ({
  className,
  children,
  node,
  ...tableProps
}) => {
  void node;
  return (
    <div
      className={cn(
        "aui-md-table-scroll my-4 min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-md border border-border bg-background",
      )}
    >
      <table
        className={cn("w-full divide-y divide-border", className)}
        data-streamdown="table"
        {...tableProps}
      >
        {children}
      </table>
    </div>
  );
};

/**
 * 对齐原 react-markdown 的视觉（标题、列表等）。
 * 表格是否带 Streamdown 默认 wrapper 由 `lib/chat-markdown-config.ts` 决定。
 */
const baseChatComponents: Partial<Components> = {
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "my-2.5 leading-normal first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "my-2.5 border-muted-foreground/30 border-l-2 pl-3 text-muted-foreground italic",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "my-2 ml-4 list-disc whitespace-normal marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "my-2 ml-4 list-decimal whitespace-normal marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("py-0.5 leading-normal [&>p]:inline", className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn("my-2 border-muted-foreground/20", className)}
      {...props}
    />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={cn("[&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  inlineCode: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]",
        className,
      )}
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold", className)} {...props} />
  ),
  h1: ({ className, style, ...props }) => (
    <h1
      className={cn(
        "mt-3 mb-1.5 scroll-m-20 font-semibold first:mt-0",
        MARKDOWN_HEADING_FONT_SIZES.h1 ? undefined : "text-base",
        className,
      )}
      style={mergeHeadingStyle("h1", style)}
      {...props}
    />
  ),
  h2: ({ className, style, ...props }) => (
    <h2
      className={cn(
        "mt-3 mb-1 scroll-m-20 font-semibold first:mt-0",
        MARKDOWN_HEADING_FONT_SIZES.h2 ? undefined : "text-sm",
        className,
      )}
      style={mergeHeadingStyle("h2", style)}
      {...props}
    />
  ),
  h3: ({ className, style, ...props }) => (
    <h3
      className={cn(
        "mt-2.5 mb-1 scroll-m-20 font-semibold first:mt-0",
        MARKDOWN_HEADING_FONT_SIZES.h3 ? undefined : "text-sm",
        className,
      )}
      style={mergeHeadingStyle("h3", style)}
      {...props}
    />
  ),
  h4: ({ className, style, ...props }) => (
    <h4
      className={cn(
        "mt-2 mb-1 scroll-m-20 font-medium first:mt-0",
        MARKDOWN_HEADING_FONT_SIZES.h4 ? undefined : "text-sm",
        className,
      )}
      style={mergeHeadingStyle("h4", style)}
      {...props}
    />
  ),
  h5: ({ className, style, ...props }) => (
    <h5
      className={cn(
        "mt-2 mb-1 font-medium first:mt-0",
        MARKDOWN_HEADING_FONT_SIZES.h5 ? undefined : "text-sm",
        className,
      )}
      style={mergeHeadingStyle("h5", style)}
      {...props}
    />
  ),
  h6: ({ className, style, ...props }) => (
    <h6
      className={cn(
        "mt-2 mb-1 font-medium first:mt-0",
        MARKDOWN_HEADING_FONT_SIZES.h6 ? undefined : "text-sm",
        className,
      )}
      style={mergeHeadingStyle("h6", style)}
      {...props}
    />
  ),
};

type StreamdownProps = ComponentProps<typeof Streamdown>;

const markdownComponents: Partial<Components> = STREAMDOWN_TABLE_USE_WRAPPER
  ? baseChatComponents
  : { ...baseChatComponents, table: SimpleTable };

const streamdownTableControls: StreamdownProps["controls"] | undefined =
  STREAMDOWN_TABLE_USE_WRAPPER ? undefined : { table: false };

const MarkdownTextInner = () => {
  const messagePart = useMessagePartText();
  const { text } = useSmooth(messagePart, true);
  const status = useSmoothStatus();
  const isAnimating = status.type === "running";

  return (
    <Streamdown
      className="aui-streamdown max-w-none min-w-0 w-full text-base leading-relaxed"
      components={markdownComponents}
      {...(streamdownTableControls !== undefined
        ? { controls: streamdownTableControls }
        : {})}
      isAnimating={isAnimating}
      mode={isAnimating ? "streaming" : "static"}
      parseIncompleteMarkdown={isAnimating}
      plugins={{ code }}
      shikiTheme={["github-light", "github-dark"]}
    >
      {text}
    </Streamdown>
  );
};

const MarkdownTextOuter = forwardRef<HTMLDivElement, Record<string, never>>(
  function MarkdownTextOuter(_props, ref) {
    const status = useSmoothStatus();
    return (
      <div
        ref={ref}
        className="aui-md wrap-break-word"
        data-status={status.type}
      >
        <MarkdownTextInner />
      </div>
    );
  },
);

MarkdownTextOuter.displayName = "MarkdownText";

const MarkdownTextWithProvider = withSmoothContextProvider(MarkdownTextOuter);

export const MarkdownText = memo(MarkdownTextWithProvider);
