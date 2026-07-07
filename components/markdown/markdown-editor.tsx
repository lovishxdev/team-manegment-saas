"use client";

import { useCallback, useRef, useState } from "react";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { ui } from "@/components/ui/ui";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
};

type EditorView = "write" | "preview";

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "text"
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const next =
    textarea.value.slice(0, start) +
    before +
    selected +
    after +
    textarea.value.slice(end);
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { next, cursorStart, cursorEnd };
}

function prefixLines(
  textarea: HTMLTextAreaElement,
  prefix: string,
  ordered = false
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, blockEnd);
  const lines = block.split("\n");
  const prefixed = lines
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (ordered) return `${index + 1}. ${trimmed}`;
      return `- ${trimmed}`;
    })
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(blockEnd);
  return { next, cursorStart: lineStart, cursorEnd: lineStart + prefixed.length };
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Add details…",
  minRows = 6,
  disabled = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<EditorView>("write");

  const applyEdit = useCallback(
    (next: string, cursorStart?: number, cursorEnd?: number) => {
      onChange(next);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        if (cursorStart !== undefined && cursorEnd !== undefined) {
          el.setSelectionRange(cursorStart, cursorEnd);
        }
      });
    },
    [onChange]
  );

  function runWrap(before: string, after: string, placeholderText?: string) {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const { next, cursorStart, cursorEnd } = wrapSelection(
      el,
      before,
      after,
      placeholderText
    );
    applyEdit(next, cursorStart, cursorEnd);
  }

  function runPrefix(prefix: string, ordered = false) {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const { next, cursorStart, cursorEnd } = prefixLines(el, prefix, ordered);
    applyEdit(next, cursorStart, cursorEnd);
  }

  function insertLink() {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const url = window.prompt("Link URL");
    if (!url?.trim()) return;
    runWrap("[", `](${url.trim()})`, "label");
  }

  const toolbarBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-faint transition hover:bg-paper-deep/80 hover:text-ink disabled:opacity-40";

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runWrap("**", "**", "bold")}
            disabled={disabled || view === "preview"}
            title="Bold"
            aria-label="Bold"
          >
            <Bold className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runWrap("*", "*", "italic")}
            disabled={disabled || view === "preview"}
            title="Italic"
            aria-label="Italic"
          >
            <Italic className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runWrap("`", "`", "code")}
            disabled={disabled || view === "preview"}
            title="Code"
            aria-label="Code"
          >
            <Code className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={insertLink}
            disabled={disabled || view === "preview"}
            title="Link"
            aria-label="Link"
          >
            <Link className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runPrefix("- ")}
            disabled={disabled || view === "preview"}
            title="Bullet list"
            aria-label="Bullet list"
          >
            <List className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runPrefix("1. ", true)}
            disabled={disabled || view === "preview"}
            title="Numbered list"
            aria-label="Numbered list"
          >
            <ListOrdered className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runPrefix("## ")}
            disabled={disabled || view === "preview"}
            title="Heading"
            aria-label="Heading"
          >
            <Heading2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex rounded-lg border border-line bg-card p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("write")}
            className={`rounded-md px-2.5 py-1 transition ${
              view === "write"
                ? "bg-paper font-medium text-ink shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setView("preview")}
            className={`rounded-md px-2.5 py-1 transition ${
              view === "preview"
                ? "bg-paper font-medium text-ink shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {view === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={minRows}
          disabled={disabled}
          className="min-h-[8rem] w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:ring-0"
        />
      ) : (
        <div className="min-h-[8rem] overflow-y-auto px-3 py-2.5">
          {value.trim() ? (
            <MarkdownContent source={value} />
          ) : (
            <p className="text-sm text-ink-faint">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  );
}
