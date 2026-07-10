"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Loader2, MoreHorizontal, Reply, Sparkles, Trash2 } from "lucide-react";
import type { MentionMember } from "@/lib/mentions";
import { extractMentionRefs } from "@/lib/mentions";
import { MentionText } from "@/components/board/mention-text";
import { AgentAvatar } from "@/components/discussion/agent-avatar";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import type { ThreadMessageView } from "@/lib/post-thread";
import { Avatar } from "@/components/ui/ui";

const agentRowCls =
  "bg-gradient-to-br from-amber-50/55 via-rose-50/35 to-transparent hover:from-amber-50/70 hover:via-rose-50/45";

function replyThreadIndent(depth: number): string {
  if (depth <= 1) return "";
  return "ml-4 border-l border-line/40 pl-4 sm:ml-5 sm:pl-5";
}

function preprocessAgentBody(body: string): string {
  return body
    .replace(/^URL:\s*https?:\/\/\S+\s*$/gim, "")
    .replace(/https?:\/\/[^\s)]+/g, (url) => {
      if (url.length <= 48) return url;
      const tail = url.split("/").pop()?.split("?")[0] ?? "file";
      try {
        return decodeURIComponent(tail);
      } catch {
        return "file in Assets";
      }
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AgentMessagePanel({ message }: { message: ThreadMessageView }) {
  return (
    <div className="mt-2 rounded-xl border border-line/80 bg-card px-3.5 py-3 shadow-[0_1px_3px_rgba(26,26,26,0.04)]">
      <MarkdownContent
        source={preprocessAgentBody(message.body)}
        variant="chat-assistant"
        className="text-[15px] leading-relaxed text-ink sm:text-sm"
      />
      <MentionTags labels={message.mentionedLabels} body={message.body} />
    </div>
  );
}

function MessageBody({
  message,
  members,
  isAgent,
}: {
  message: ThreadMessageView;
  members: MentionMember[];
  isAgent: boolean;
}) {
  if (isAgent) {
    return <AgentMessagePanel message={message} />;
  }

  return (
    <MentionText body={message.body} members={members} className="text-[15px] sm:text-sm" />
  );
}

function formatCompactTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return time;

  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} · ${time}`;
}

function formatOpenerTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MentionTags({ labels, body }: { labels: string[]; body: string }) {
  const inBody = new Set(extractMentionRefs(body));
  const extra = labels.filter((label) => !inBody.has(label.toLowerCase()));
  if (extra.length === 0) return null;

  return (
    <p className="mt-1.5 flex flex-wrap gap-1">
      {extra.map((label) => (
        <span
          key={label}
          className="rounded bg-paper-deep px-1.5 py-0.5 text-xs font-medium text-ink-soft"
        >
          @{label}
        </span>
      ))}
    </p>
  );
}

function MessageMenu({
  message,
  isOpener,
  isOwn,
  branchDisabled,
  onReply,
  onToggleSave,
  onDelete,
  onBranchToAgent,
}: {
  message: ThreadMessageView;
  isOpener: boolean;
  isOwn: boolean;
  branchDisabled?: boolean;
  onReply: (message: ThreadMessageView) => void;
  onToggleSave: (message: ThreadMessageView) => void;
  onDelete: (message: ThreadMessageView) => void;
  onBranchToAgent?: (message: ThreadMessageView) => void;
}) {
  const saveDisabled =
    message.isAgentGenerated || message.isAgentPrivate;
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
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition hover:bg-paper-deep/80 hover:text-ink ${
          menuOpen ? "bg-paper-deep/80 text-ink opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        aria-label="Message actions"
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-line bg-card py-1 shadow-[0_8px_24px_rgba(26,26,26,0.12)]">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setMenuOpen(false);
              onReply(message);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-paper-deep/50"
          >
            <Reply className="h-3.5 w-3.5" strokeWidth={1.75} />
            Reply
          </button>
          {onBranchToAgent && !branchDisabled ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setMenuOpen(false);
                onBranchToAgent(message);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-paper-deep/50"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
              Branch to agent
            </button>
          ) : null}
          {!saveDisabled ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setMenuOpen(false);
                onToggleSave(message);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-paper-deep/50"
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${message.saved ? "fill-current" : ""}`}
                strokeWidth={1.75}
              />
              {message.saved ? "Unsave" : "Save"}
            </button>
          ) : null}
          {isOwn && !isOpener ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setMenuOpen(false);
                onDelete(message);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PostMessageRow({
  message,
  members,
  currentUserId,
  isOpener = false,
  openerAuthorLabel,
  branchPending = false,
  branchDisabled = false,
  onReply,
  onToggleSave,
  onDelete,
  onBranchToAgent,
}: {
  message: ThreadMessageView;
  members: MentionMember[];
  currentUserId: string;
  isOpener?: boolean;
  /** Hide redundant "replying to opener" labels on direct replies. */
  openerAuthorLabel?: string;
  branchPending?: boolean;
  branchDisabled?: boolean;
  onReply: (message: ThreadMessageView) => void;
  onToggleSave: (message: ThreadMessageView) => void;
  onDelete: (message: ThreadMessageView) => void;
  onBranchToAgent?: (message: ThreadMessageView) => void;
}) {
  const isOwn = message.authorId === currentUserId && !message.isAgentGenerated;
  const isAgent = message.isAgentGenerated;
  const isPrivateRequest = message.isAgentPrivate && !isAgent;
  const showReplyTarget =
    !isOpener &&
    message.replyToLabel &&
    message.depth > 1 &&
    message.replyToLabel !== openerAuthorLabel;

  if (isOpener) {
    return (
      <article
        className={`group px-4 py-5 sm:px-5 ${isAgent ? agentRowCls : ""}`}
      >
        <div className="flex gap-3">
          {isAgent ? (
            <AgentAvatar size="md" />
          ) : (
            <Avatar
              seed={message.authorId}
              label={message.authorLabel}
              size="h-9 w-9 text-xs"
            />
          )}
          <div className="min-w-0 flex-1">
            <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-semibold text-ink">
                {isAgent ? "Euclis agent" : isOwn ? "Me" : message.authorLabel}
              </span>
              {isPrivateRequest ? (
                <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft ring-1 ring-line">
                  Private
                </span>
              ) : null}
              {isAgent && message.agentTriggeredByLabel ? (
                <span className="text-xs text-ink-faint">
                  · requested by @{message.agentTriggeredByLabel}
                </span>
              ) : null}
              <span className="text-ink-faint">·</span>
              <time
                className="text-xs text-ink-faint"
                dateTime={message.createdAt}
                title={new Date(message.createdAt).toLocaleString()}
              >
                {formatOpenerTimestamp(message.createdAt)}
              </time>
              <div className="ml-auto">
                <MessageMenu
                  message={message}
                  isOpener
                  isOwn={isOwn}
                  branchDisabled={branchDisabled}
                  onReply={onReply}
                  onToggleSave={onToggleSave}
                  onDelete={onDelete}
                  onBranchToAgent={onBranchToAgent}
                />
              </div>
            </header>
            <div className="text-ink">
              <MessageBody message={message} members={members} isAgent={isAgent} />
            </div>
            {!isAgent ? (
              <MentionTags labels={message.mentionedLabels} body={message.body} />
            ) : null}
            {branchPending ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                <Loader2 className="h-4 w-4 animate-spin text-amber-700" strokeWidth={2} />
                Agent is investigating…
              </p>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group px-4 py-2.5 transition-colors sm:px-5 ${replyThreadIndent(message.depth)} ${
        isAgent ? agentRowCls : "hover:bg-paper-deep/25"
      }`}
    >
      {showReplyTarget ? (
        <p className="mb-1 pl-9 text-[11px] text-ink-faint">
          ↳ @{message.replyToLabel}
        </p>
      ) : null}

      <div className="flex gap-2.5">
        {isAgent ? (
          <AgentAvatar size="sm" />
        ) : (
          <Avatar
            seed={message.authorId}
            label={message.authorLabel}
            size="h-7 w-7 text-[10px]"
          />
        )}
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <span className="text-sm font-semibold text-ink">
              {isAgent ? "Euclis agent" : isOwn ? "Me" : message.authorLabel}
            </span>
            {isPrivateRequest ? (
              <span className="rounded-full bg-paper-deep px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-soft ring-1 ring-line">
                Private
              </span>
            ) : null}
            {isAgent && message.agentTriggeredByLabel ? (
              <span className="text-[11px] text-ink-faint">
                · @{message.agentTriggeredByLabel}
              </span>
            ) : null}
            <time
              className="text-[11px] text-ink-faint"
              dateTime={message.createdAt}
              title={new Date(message.createdAt).toLocaleString()}
            >
              {formatCompactTimestamp(message.createdAt)}
            </time>
            <div className="ml-auto -mr-1">
              <MessageMenu
                message={message}
                isOpener={false}
                isOwn={isOwn}
                branchDisabled={branchDisabled}
                onReply={onReply}
                onToggleSave={onToggleSave}
                onDelete={onDelete}
                onBranchToAgent={onBranchToAgent}
              />
            </div>
          </header>
          <div className="mt-0.5 text-ink">
            <MessageBody
              message={message}
              members={members}
              isAgent={isAgent}
            />
          </div>
          {!isAgent ? (
            <MentionTags labels={message.mentionedLabels} body={message.body} />
          ) : null}
          {branchPending ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" strokeWidth={2} />
              Agent is investigating…
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
