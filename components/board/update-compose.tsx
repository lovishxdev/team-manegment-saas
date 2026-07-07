"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import {
  applyMentionSelection,
  filterMentionMembers,
  mentionComposeState,
  type MentionMember,
} from "@/lib/mentions";
import { Avatar, ui } from "@/components/ui/ui";

export function UpdateCompose({
  members,
  value,
  onChange,
  onPost,
  pending,
  textareaRef: externalRef,
  placeholder = "Share progress, blockers, or context… (@ to mention)",
  inputId = "task-update-compose",
}: {
  members: MentionMember[];
  value: string;
  onChange: (value: string) => void;
  onPost: () => void;
  pending?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  inputId?: string;
}) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef ?? internalRef;
  const [cursor, setCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const composeState = useMemo(
    () => mentionComposeState(value, cursor),
    [value, cursor]
  );

  const options = useMemo(() => {
    if (!composeState?.open) return [];
    return filterMentionMembers(members, composeState.query);
  }, [composeState, members]);

  const mentionOpen = Boolean(composeState?.open);

  useEffect(() => {
    setMentionIndex(0);
  }, [composeState?.query]);

  function syncCursor() {
    const el = textareaRef.current;
    if (el) setCursor(el.selectionStart ?? 0);
  }

  function selectMention(member: MentionMember) {
    if (!composeState) return;
    const { next, cursor: nextCursor } = applyMentionSelection(
      value,
      composeState,
      member.label
    );
    onChange(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen && options.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((index) => Math.min(index + 1, options.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectMention(options[mentionIndex] ?? options[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        return;
      }
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onPost();
    }
  }

  return (
    <div className="relative mt-4 rounded-xl border border-line bg-paper-deep/35 p-3">
      {mentionOpen ? (
        <div
          className="absolute bottom-full left-0 right-0 z-20 mb-1.5 overflow-hidden rounded-lg border border-line bg-white shadow-[0_8px_24px_rgba(26,26,26,0.12)]"
          role="listbox"
          aria-label="Mention a teammate"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-ink-faint">No matching members</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto p-1">
              {options.map((member, index) => {
                const active = index === mentionIndex;
                return (
                  <li key={member.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectMention(member);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-ink/[0.06] text-ink"
                          : "text-ink-soft hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                    >
                      <Avatar
                        seed={member.id}
                        label={member.label}
                        size="h-7 w-7 text-[10px]"
                      />
                      <span className="font-medium">@{member.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <label htmlFor={inputId} className="sr-only">
        Write a message
      </label>
      <textarea
        ref={textareaRef}
        id={inputId}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart ?? 0);
        }}
        onSelect={syncCursor}
        onKeyUp={syncCursor}
        onClick={syncCursor}
        onKeyDown={handleKeyDown}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none border-0 bg-transparent px-1 py-1 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0"
      />

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-line/60 pt-2">
        <span className="text-xs text-ink-faint">
          @ mention · ⌘/Ctrl+Enter to post
        </span>
        <button
          type="button"
          onClick={onPost}
          disabled={pending || !value.trim()}
          className={`${ui.btnPrimary} inline-flex items-center gap-1.5`}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
