import type { ReactNode } from "react";
import { ClaudeIcon } from "@/components/brand/claude-icon";

/** claude.ai-style chat chrome for marketing recordings. */
export function ClaudeChatMock({
  children,
  subtitle = "Euclis MCP connector",
  className = "",
  embedded = false,
}: {
  children: ReactNode;
  subtitle?: string;
  className?: string;
  /** Fill a mobile phone frame — no outer card chrome. */
  embedded?: boolean;
}) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
        embedded
          ? "h-full bg-[#f4f3ee]"
          : `shrink-0 rounded-[1.75rem] border border-[#e8e6df] bg-[#f4f3ee] shadow-xl ${className}`
      }`}
    >
      <div
        className={`flex shrink-0 items-center gap-2.5 border-b border-[#e8e6df] bg-[#fdfcf8] ${
          embedded ? "px-3.5 pb-2.5 pt-8" : "px-5 py-4"
        }`}
      >
        <ClaudeIcon
          className={`shrink-0 text-claude ${embedded ? "h-6 w-6" : "h-8 w-8"}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-[#2d2b26] ${embedded ? "text-[13px]" : ""}`}>
            Claude
          </p>
          <p
            className={`truncate text-[#6b6560] ${embedded ? "text-[10px]" : "text-[12px]"}`}
          >
            {subtitle}
          </p>
        </div>
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f4f3ee] ${
          embedded ? "p-3" : "gap-4 p-5"
        }`}
      >
        {children}
      </div>
      {embedded ? <ClaudeChatInputBar /> : null}
    </div>
  );
}

function ClaudeChatInputBar() {
  return (
    <div className="flex shrink-0 items-end gap-1.5 border-t border-[#e8e6df] bg-[#fdfcf8] px-2.5 py-1.5">
      <div className="flex min-h-[2rem] flex-1 items-center rounded-2xl border border-[#e8e6df] bg-white px-2.5 py-1.5 text-[11px] text-[#9ca3af]">
        Reply to Claude…
      </div>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#c15f3c] text-white shadow-sm">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M2.4 9.3l14.2-5.9c.7-.3 1.4.4 1.1 1.1l-5.9 14.2c-.3.7-1.3.7-1.6 0L8 12l-5.6-1.1c-.8-.2-.8-1.3 0-1.6z" />
        </svg>
      </div>
    </div>
  );
}

/** User message — warm tan bubble (claude.ai), not dark mode. */
export function ClaudeUserBubble({
  children,
  showCaret = false,
}: {
  children: ReactNode;
  showCaret?: boolean;
}) {
  return (
    <div className="ml-auto max-w-[92%] rounded-[1.25rem] rounded-tr-md bg-[#e8e4da] px-3 py-2 text-[13px] leading-relaxed text-[#2d2b26]">
      {children}
      {showCaret ? <span className="mkt-caret" /> : null}
    </div>
  );
}

export function ClaudeAssistantText({
  children,
  showCaret = false,
}: {
  children: ReactNode;
  showCaret?: boolean;
}) {
  return (
    <div className="mr-auto max-w-[95%] text-[13px] leading-relaxed text-[#2d2b26]">
      {children}
      {showCaret ? <span className="mkt-caret" /> : null}
    </div>
  );
}

export function ClaudeThinkingIndicator() {
  return (
    <div className="mr-auto flex items-center gap-2 text-[14px] text-[#6b6560]">
      <ClaudeIcon className="h-4 w-4 animate-pulse text-claude" />
      Thinking…
    </div>
  );
}

export function ClaudeMcpToolCard({
  toolName,
  args,
}: {
  toolName: string;
  args: string;
}) {
  return (
    <div className="mkt-tool-pop overflow-hidden rounded-xl border border-[#e8e6df] bg-[#fdfcf8] shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#e8e6df] bg-[#faf8f2] px-3 py-2 font-mono text-[11px]">
        <span className="rounded bg-claude/15 px-1.5 py-0.5 font-semibold text-claude-dark">
          MCP
        </span>
        <span className="font-semibold text-[#2d2b26]">euclis · {toolName}</span>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-[#5c5852]">
        {args}
      </pre>
    </div>
  );
}
