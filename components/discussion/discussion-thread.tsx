"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, Pin, Trash2 } from "lucide-react";
import type { PostKind, PostStatus } from "@/lib/generated/prisma/client";
import {
  createDiscussionReplyAction,
  deleteDiscussionAction,
  deleteDiscussionMessageAction,
  fetchDiscussionThreadAction,
  setDiscussionMessageSavedAction,
  setDiscussionPinnedAction,
  setDiscussionStatusAction,
  setDiscussionTaskLinkAction,
} from "@/lib/actions/discussion";
import { fetchWorkspaceMemberLabelsAction } from "@/lib/actions/workspace";
import type { ChatMessageView } from "@/lib/chat-message";
import { taskPath } from "@/lib/task-navigation";
import { UpdateCompose } from "@/components/board/update-compose";
import { PostKindBadge } from "@/components/discussion/post-kind-badge";
import { PostMessageRow } from "@/components/discussion/post-message-row";
import { TaskLinkPicker } from "@/components/discussion/task-link-picker";
import type { MentionMember } from "@/lib/mentions";
import { bodyMentionsAgent, discussionMentionMembers } from "@/lib/mentions";
import { buildThreadMessageViews, type ThreadMessageView } from "@/lib/post-thread";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { ChatBubbleSkeleton } from "@/components/ui/loading";
import { ui } from "@/components/ui/ui";

export function DiscussionThread({
  workspaceId,
  postId,
  currentUserId,
  canManageDiscussions = false,
}: {
  workspaceId: string;
  postId: string;
  currentUserId: string;
  canManageDiscussions?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Discussion");
  const [kind, setKind] = useState<PostKind>("DISCUSSION");
  const [status, setStatus] = useState<PostStatus>("OPEN");
  const [pinned, setPinned] = useState(false);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [taskShortId, setTaskShortId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [pendingTaskLink, setPendingTaskLink] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [members, setMembers] = useState<MentionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ThreadMessageView | null>(null);
  const [branchingMessageId, setBranchingMessageId] = useState<string | null>(
    null
  );
  const [postPending, startPostTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const searchParams = useSearchParams();
  const branchAgentOnLoadRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipRealtimeUntilRef = useRef(0);

  const loadThread = useCallback(async (options?: { silent?: boolean }) => {
    const result = await fetchDiscussionThreadAction(workspaceId, postId);
    if (result.error) {
      if (result.error === "Discussion not found") {
        router.replace(`/w/${workspaceId}/discussion`);
        return;
      }
      if (!options?.silent) {
        setError(result.error);
      }
      setLoading(false);
      return;
    }
    setError(null);
    if (result.post) {
      setTitle(result.post.title);
      setKind(result.post.kind);
      setStatus(result.post.status);
      setPinned(result.post.pinned);
      setAuthorId(result.post.authorId);
      setTaskShortId(result.post.taskShortId);
      setTaskTitle(result.post.taskTitle);
      setPendingTaskLink(result.post.taskShortId);
    }
    setMessages(result.messages ?? []);
    setLoading(false);
  }, [workspaceId, postId, router]);

  useEffect(() => {
    void loadThread();
    fetchWorkspaceMemberLabelsAction(workspaceId).then(setMembers);
  }, [loadThread, workspaceId]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel(`discussion-thread-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "PostMessage",
          filter: `postId=eq.${postId}`,
        },
        () => {
          if (Date.now() < skipRealtimeUntilRef.current) return;
          void loadThread({ silent: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Post",
          filter: `id=eq.${postId}`,
        },
        () => {
          if (Date.now() < skipRealtimeUntilRef.current) return;
          void loadThread({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [postId, loadThread]);

  const threadMessages = useMemo(
    () =>
      buildThreadMessageViews(
        messages.map((m) => ({
          ...m,
          parentMessageId: m.parentMessageId ?? null,
        }))
      ),
    [messages]
  );

  const opener = threadMessages.find((m) => m.parentMessageId === null);
  const replies = threadMessages.filter((m) => m.parentMessageId !== null);
  const openerId = opener?.id;

  function handleReply(message: ThreadMessageView) {
    setReplyTo(message);
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  }

  function handlePost() {
    const body = draft.trim();
    if (!body || postPending) return;
    const parentMessageId = replyTo?.id ?? openerId;
    if (!parentMessageId) return;

    skipRealtimeUntilRef.current = Date.now() + 2500;
    const pageScrollY = window.scrollY;

    startPostTransition(async () => {
      const askedAgent = bodyMentionsAgent(body);
      const result = await createDiscussionReplyAction(
        workspaceId,
        postId,
        body,
        parentMessageId
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft("");
      setReplyTo(null);
      await loadThread();
      if (askedAgent && result.message) {
        await runAgentBranch({
          id: result.message.id,
          body: result.message.body,
          createdAt: result.message.createdAt,
          authorId: result.message.authorId,
          authorLabel: result.message.authorLabel,
          parentMessageId: result.message.parentMessageId ?? parentMessageId,
          mentionedLabels: result.message.mentionedLabels,
          saved: result.message.saved ?? false,
          isAgentGenerated: false,
          isAgentPrivate: result.message.isAgentPrivate ?? false,
          agentTriggeredByLabel: null,
          depth: 0,
          replyToLabel: null,
        });
      }
      requestAnimationFrame(() => {
        window.scrollTo(0, pageScrollY);
        textareaRef.current?.focus({ preventScroll: true });
      });
    });
  }

  function handleToggleSave(message: ThreadMessageView) {
    const nextSaved = !message.saved;
    const pageScrollY = window.scrollY;

    setMessages((current) =>
      current.map((row) =>
        row.id === message.id ? { ...row, saved: nextSaved } : row
      )
    );
    requestAnimationFrame(() => window.scrollTo(0, pageScrollY));

    startActionTransition(async () => {
      const result = await setDiscussionMessageSavedAction(
        workspaceId,
        postId,
        message.id,
        nextSaved
      );
      if (result.error) {
        setError(result.error);
        setMessages((current) =>
          current.map((row) =>
            row.id === message.id ? { ...row, saved: message.saved } : row
          )
        );
        return;
      }
      setMessages((current) =>
        current.map((row) =>
          row.id === message.id
            ? { ...row, saved: result.saved ?? nextSaved }
            : row
        )
      );
    });
  }

  function handleDelete(message: ThreadMessageView) {
    if (!confirm("Delete this reply? This cannot be undone.")) return;
    startActionTransition(async () => {
      const result = await deleteDiscussionMessageAction(
        workspaceId,
        postId,
        message.id
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      await loadThread();
    });
  }

  const mentionOptions = useMemo(
    () => discussionMentionMembers(members, currentUserId),
    [members, currentUserId]
  );

  async function runAgentBranch(message: ThreadMessageView) {
    if (isClosed || branchingMessageId) return;
    setBranchingMessageId(message.id);
    setError(null);
    try {
      const response = await fetch("/api/discussion/branch-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          postId,
          messageId: message.id,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Agent branch failed");
        return;
      }
      skipRealtimeUntilRef.current = Date.now() + 2500;
      await loadThread();
    } catch {
      setError("Agent branch failed — try again");
    } finally {
      setBranchingMessageId(null);
    }
  }

  function handleBranchToAgent(message: ThreadMessageView) {
    void runAgentBranch(message);
  }

  const canLinkTask =
    canManageDiscussions || (authorId !== null && authorId === currentUserId);
  const canCloseThread = canLinkTask;
  const isClosed = status === "RESOLVED";

  useEffect(() => {
    if (branchAgentOnLoadRef.current) return;
    if (searchParams.get("branchAgent") !== "1" || !opener || isClosed) return;
    branchAgentOnLoadRef.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    if (bodyMentionsAgent(opener.body)) {
      void runAgentBranch(opener);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after opener loads
  }, [opener, isClosed, searchParams]);

  function handleDeleteDiscussion() {
    if (
      !window.confirm(
        "Delete this discussion and all its messages? This cannot be undone."
      )
    ) {
      return;
    }
    startActionTransition(async () => {
      const result = await deleteDiscussionAction(workspaceId, postId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace(`/w/${workspaceId}/discussion`);
    });
  }

  function handleTogglePin() {
    const nextPinned = !pinned;
    startActionTransition(async () => {
      const result = await setDiscussionPinnedAction(
        workspaceId,
        postId,
        nextPinned
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setPinned(result.pinned ?? nextPinned);
    });
  }

  function handleToggleStatus() {
    const nextStatus: PostStatus = isClosed ? "OPEN" : "RESOLVED";
    startActionTransition(async () => {
      const result = await setDiscussionStatusAction(
        workspaceId,
        postId,
        nextStatus
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(result.status ?? nextStatus);
      setError(null);
    });
  }

  function handleTaskLinkChange(shortId: number | null, title: string | null) {
    const previousShortId = taskShortId;
    const previousTitle = taskTitle;
    setPendingTaskLink(shortId);
    if (title) setTaskTitle(title);
    startActionTransition(async () => {
      const result = await setDiscussionTaskLinkAction(
        workspaceId,
        postId,
        shortId
      );
      if (result.error) {
        setError(result.error);
        setPendingTaskLink(previousShortId);
        setTaskTitle(previousTitle);
        return;
      }
      setTaskShortId(result.taskShortId ?? null);
      setTaskTitle(result.taskTitle ?? title);
      setPendingTaskLink(result.taskShortId ?? null);
      setError(null);
    });
  }

  if (loading) {
    return <ChatBubbleSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/w/${workspaceId}/discussion`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        All discussions
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PostKindBadge kind={kind} />
              {isClosed ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-paper-deep px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft ring-1 ring-line">
                  <Lock className="h-3 w-3" strokeWidth={2} />
                  Closed
                </span>
              ) : null}
              {pinned ? (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Pinned
                </span>
              ) : null}
            </div>
            <h2 className={ui.workspaceTitle}>{title}</h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canCloseThread ? (
              <button
                type="button"
                onClick={handleDeleteDiscussion}
                disabled={actionPending}
                className={`${ui.btnGhostDanger} inline-flex items-center gap-1.5`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Delete
              </button>
            ) : null}
            {canCloseThread ? (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={actionPending}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isClosed
                    ? "bg-paper-deep text-ink-soft ring-1 ring-line hover:text-ink"
                    : "bg-paper-deep text-ink-soft ring-1 ring-line hover:text-ink"
                }`}
              >
                <Lock className="h-4 w-4" strokeWidth={2} />
                {isClosed ? "Reopen" : "Close"}
              </button>
            ) : null}
            {canManageDiscussions ? (
            <button
              type="button"
              onClick={handleTogglePin}
              disabled={actionPending}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pinned
                  ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  : "bg-paper-deep text-ink-soft ring-1 ring-line hover:text-ink"
              }`}
            >
              <Pin
                className="h-4 w-4"
                strokeWidth={2}
                fill={pinned ? "currentColor" : "none"}
              />
              {pinned ? "Unpin" : "Pin"}
            </button>
            ) : null}
          </div>
        </div>
        {taskShortId && !canLinkTask ? (
          <Link
            href={taskPath(workspaceId, taskShortId)}
            className="inline-flex text-sm font-medium text-ink-soft hover:text-ink"
          >
            Linked to task #{taskShortId}
            {taskTitle ? `: ${taskTitle}` : ""}
          </Link>
        ) : null}
        {canLinkTask ? (
          <div className="max-w-md space-y-2">
            <label className={ui.label}>Link task</label>
            <TaskLinkPicker
              workspaceId={workspaceId}
              value={pendingTaskLink}
              selectedTitle={taskTitle}
              onChange={handleTaskLinkChange}
              disabled={actionPending}
            />
          </div>
        ) : null}
        <p className={`${ui.fieldHint} max-w-2xl`}>
          Reply to a specific message — decisions here can be captured into
          project memory like task updates.
        </p>
      </header>

      {error ? <p className={ui.errorText}>{error}</p> : null}

      <section
        className={`${ui.contentPanel} ${ui.chatShellTall} !p-0 ${
          isClosed ? "opacity-[0.98]" : ""
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain updates-scroll">
          {opener ? (
            <PostMessageRow
              message={opener}
              members={members}
              currentUserId={currentUserId}
              isOpener
              branchPending={branchingMessageId === opener.id}
              branchDisabled={isClosed || branchingMessageId !== null}
              onReply={handleReply}
              onToggleSave={handleToggleSave}
              onDelete={handleDelete}
              onBranchToAgent={handleBranchToAgent}
            />
          ) : null}

          {replies.length > 0 ? (
            <div className="border-t border-line">
              <div className="border-b border-line/60 bg-paper-deep/20 px-4 py-2 sm:px-5">
                <span className="text-xs font-medium text-ink-faint">
                  {replies.length} {replies.length === 1 ? "reply" : "replies"}
                </span>
              </div>
              <ul className="divide-y divide-line/60">
                {replies.map((message) => (
                  <li key={message.id}>
                    <PostMessageRow
                      message={message}
                      members={members}
                      currentUserId={currentUserId}
                      openerAuthorLabel={opener?.authorLabel}
                      branchPending={branchingMessageId === message.id}
                      branchDisabled={isClosed || branchingMessageId !== null}
                      onReply={handleReply}
                      onToggleSave={handleToggleSave}
                      onDelete={handleDelete}
                      onBranchToAgent={handleBranchToAgent}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-line bg-card px-4 py-3 sm:px-5">
          {isClosed ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper-deep/40 px-3 py-2.5 text-sm text-ink-soft">
              <Lock className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
              <span>
                This discussion is closed.
                {canCloseThread ? " Reopen it to add replies." : " New replies are not accepted."}
              </span>
            </div>
          ) : (
            <>
          {replyTo ? (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-paper-deep/30 px-3 py-2 text-sm text-ink-soft">
              <span>
                Replying to{" "}
                <span className="font-medium text-ink">@{replyTo.authorLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-xs font-medium text-ink-faint hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : null}
          <UpdateCompose
            members={mentionOptions}
            value={draft}
            onChange={setDraft}
            onPost={handlePost}
            pending={postPending}
            textareaRef={textareaRef}
            placeholder={
              replyTo
                ? `Reply to @${replyTo.authorLabel}… (@euclis to ask the agent)`
                : "Reply to this discussion… (@euclis to ask the agent)"
            }
            inputId="discussion-thread-compose"
            className="relative mt-0"
          />
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
