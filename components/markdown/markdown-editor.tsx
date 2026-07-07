"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Pencil,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown/markdown-content";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
};

type EditorView = "write" | "preview";

function initialView(content: string): EditorView {
  return content.trim() ? "preview" : "write";
}

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
      return `${prefix}${trimmed}`;
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
  const lastEmitted = useRef(value);
  const [localValue, setLocalValue] = useState(value);
  const [view, setView] = useState<EditorView>(() => initialView(value));

  // Sync external value changes without clobbering the browser undo stack.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setLocalValue(value);
      lastEmitted.current = value;
      setView(initialView(value));
    }
  }, [value]);

  const emitChange = useCallback(
    (next: string) => {
      setLocalValue(next);
      lastEmitted.current = next;
      onChange(next);
    },
    [onChange]
  );

  const applyEdit = useCallback(
    (next: string, cursorStart?: number, cursorEnd?: number) => {
      emitChange(next);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        if (cursorStart !== undefined && cursorEnd !== undefined) {
          el.setSelectionRange(cursorStart, cursorEnd);
        }
      });
    },
    [emitChange]
  );

  const withTextarea = useCallback(
    (run: (el: HTMLTextAreaElement) => void) => {
      if (disabled) return;

      const execute = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        run(el);
      };

      if (view === "preview") {
        setView("write");
        requestAnimationFrame(execute);
        return;
      }

      execute();
    },
    [disabled, view]
  );

  function runWrap(before: string, after: string, placeholderText?: string) {
    withTextarea((el) => {
      const { next, cursorStart, cursorEnd } = wrapSelection(
        el,
        before,
        after,
        placeholderText
      );
      applyEdit(next, cursorStart, cursorEnd);
    });
  }

  function runPrefix(prefix: string, ordered = false) {
    withTextarea((el) => {
      const { next, cursorStart, cursorEnd } = prefixLines(el, prefix, ordered);
      applyEdit(next, cursorStart, cursorEnd);
    });
  }

  function insertLink() {
    runWrap("[", "](link)", "label");
  }

  const toolbarBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-faint transition hover:bg-paper-deep/80 hover:text-ink disabled:opacity-40";

  const toolbarDisabled = disabled;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runWrap("**", "**", "bold")}
            disabled={toolbarDisabled}
            title="Bold"
            aria-label="Bold"
          >
            <Bold className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runWrap("*", "*", "italic")}
            disabled={toolbarDisabled}
            title="Italic"
            aria-label="Italic"
          >
            <Italic className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runWrap("`", "`", "code")}
            disabled={toolbarDisabled}
            title="Code"
            aria-label="Code"
          >
            <Code className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={insertLink}
            disabled={toolbarDisabled}
            title="Link"
            aria-label="Link"
          >
            <Link className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runPrefix("- ")}
            disabled={toolbarDisabled}
            title="Bullet list"
            aria-label="Bullet list"
          >
            <List className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runPrefix("1. ", true)}
            disabled={toolbarDisabled}
            title="Numbered list"
            aria-label="Numbered list"
          >
            <ListOrdered className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => runPrefix("## ")}
            disabled={toolbarDisabled}
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
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
              view === "write"
                ? "bg-paper font-medium text-ink shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Pencil className="h-3 w-3" strokeWidth={1.75} />
            Edit
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
          value={localValue}
          onChange={(event) => emitChange(event.target.value)}
          placeholder={placeholder}
          rows={minRows}
          disabled={disabled}
          className="min-h-[10rem] w-full resize-y border-0 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint outline-none focus:ring-0"
        />
      ) : (
        <div
          role="presentation"
          onClick={(event) => {
            if (disabled) return;
            if ((event.target as HTMLElement).closest("a")) return;
            setView("write");
          }}
          className={`min-h-[10rem] overflow-y-auto px-4 py-3 ${
            disabled ? "" : "cursor-text hover:bg-paper-deep/20"
          }`}
        >
          {localValue.trim() ? (
            <MarkdownContent source={localValue} />
          ) : (
            <p className="text-[15px] text-ink-faint">{placeholder}</p>
          )}
        </div>
      )}
    </div>
  );
}
