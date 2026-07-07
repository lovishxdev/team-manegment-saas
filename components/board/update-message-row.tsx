"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import type { TaskUpdateView } from "@/lib/actions/workspace";
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
  update,
  members,
  currentUserId,
  onReply,
  onToggleSave,
  onDelete,
}: {
  update: TaskUpdateView;
  members: MentionMember[];
  currentUserId: string;
  onReply: (update: TaskUpdateView) => void;
  onToggleSave: (update: TaskUpdateView) => void;
  onDelete: (update: TaskUpdateView) => void;
}) {
  const isOwn = update.authorId === currentUserId;
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
    <article className="group rounded-xl bg-paper-deep/30 px-4 py-3 transition-colors hover:bg-paper-deep/50">
      <div className="flex gap-3">
        <Avatar
          seed={update.authorId}
          label={update.authorLabel}
          size="h-9 w-9 text-xs"
        />
        <div className="min-w-0 flex-1">
          <header className="mb-1.5 flex items-start gap-2">
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">
              {isOwn ? "Me" : update.authorLabel}
            </span>

            <div className="flex shrink-0 items-center gap-0.5">
              <time
                className="whitespace-nowrap text-xs text-ink-faint"
                dateTime={update.createdAt}
                title={new Date(update.createdAt).toLocaleString()}
              >
                {formatMessageTimestamp(update.createdAt)}
              </time>

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
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleSave(update);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink"
                    >
                      <Bookmark
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.75}
                        fill={update.saved ? "currentColor" : "none"}
                      />
                      {update.saved ? "Unsave" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onReply(update);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink"
                    >
                      <Reply className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      Reply
                    </button>
                    {isOwn ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(update);
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
            body={update.body}
            members={members}
            className="text-[15px] leading-relaxed text-ink"
          />
          {update.mentionedLabels.length > 0 ? (
            <MentionTags labels={update.mentionedLabels} body={update.body} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
