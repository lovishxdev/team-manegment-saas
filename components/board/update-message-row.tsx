"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import type { ChatMessageView } from "@/lib/chat-message";
import type { MentionMember } from "@/lib/mentions";
import { extractMentionRefs } from "@/lib/mentions";
import { MentionText } from "@/components/board/mention-text";
import { Avatar } from "@/components/ui/ui";

export function formatMessageTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
}

function MentionTags({ labels, body }: { labels: string[]; body: string }) {
  const inBody = new Set(extractMentionRefs(body));
  const extra = labels.filter((label) => !inBody.has(label.toLowerCase()));
  if (extra.length === 0) return null;

  return (
    <p className="mt-2 flex flex-wrap gap-1.5">
      {extra.map((label) => (
        <span
          key={label}
          className="rounded bg-white/80 px-1.5 py-0.5 text-xs font-semibold text-ink"
        >
          @{label}
        </span>
      ))}
    </p>
  );
}

export function UpdateMessageRow({
  message,
  members,
  currentUserId,
  onReply,
  onToggleSave,
  onDelete,
}: {
  message: ChatMessageView;
  members: MentionMember[];
  currentUserId: string;
  onReply: (message: ChatMessageView) => void;
  onToggleSave: (message: ChatMessageView) => void;
  onDelete: (message: ChatMessageView) => void;
}) {
  const isOwn = message.authorId === currentUserId;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <article className="group rounded-xl border border-line bg-white px-3.5 py-2.5 shadow-[0_1px_3px_rgba(26,26,26,0.04)] transition-[border-color,box-shadow] hover:border-line-strong sm:px-4 sm:py-3">
      <div className="flex gap-2.5 sm:gap-3">
        <Avatar
          seed={message.authorId}
          label={message.authorLabel}
          size="h-8 w-8 text-[11px] sm:h-9 sm:w-9 sm:text-xs"
        />
        <div className="min-w-0 flex-1">
          <header className="mb-0.5 flex items-baseline gap-1.5 sm:mb-1">
            <span className="text-sm font-semibold text-ink sm:text-[15px]">
              {isOwn ? "Me" : message.authorLabel}
            </span>
            <time
              className="text-[11px] text-ink-faint sm:text-xs"
              dateTime={message.createdAt}
              title={new Date(message.createdAt).toLocaleString()}
            >
              {formatMessageTimestamp(message.createdAt)}
            </time>

            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-white/70 hover:text-ink ${
                    menuOpen
                      ? "bg-white/70 text-ink opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  aria-label="Message options"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-line bg-white py-1 shadow-[0_8px_24px_rgba(26,26,26,0.12)]">
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleSave(message);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink"
                    >
                      <Bookmark
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.75}
                        fill={message.saved ? "currentColor" : "none"}
                      />
                      {message.saved ? "Unsave" : "Save"}
                    </button>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setMenuOpen(false);
                        onReply(message);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink"
                    >
                      <Reply className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      Reply
                    </button>
                    {isOwn ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(message);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <MentionText
            body={message.body}
            members={members}
            className="text-sm leading-snug text-ink sm:text-[15px] sm:leading-relaxed"
          />
          {message.mentionedLabels.length > 0 ? (
            <MentionTags labels={message.mentionedLabels} body={message.body} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
