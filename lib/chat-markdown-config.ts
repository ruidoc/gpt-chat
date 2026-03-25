/**
 * Markdown（Streamdown）表格呈现
 *
 * - `true`：使用 Streamdown 默认 `table-wrapper`（复制 / 下载 / 全屏等工具条）
 * - `false`：仅内层横向滚动 + `<table>`，无外层工具栏（当前默认）
 */
export const STREAMDOWN_TABLE_USE_WRAPPER = false;

/** 可配置任意 `h1`–`h6`；值为合法 CSS `font-size`（如 `"20px"`、`"1.125rem"`）。未写的级别沿用 markdown 组件里的 Tailwind 字号。 */
export type MarkdownHeadingFontSizes = Partial<
  Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", string>
>;

export const MARKDOWN_HEADING_FONT_SIZES: MarkdownHeadingFontSizes = {
  h2: "20px",
  h3: "18px",
};
