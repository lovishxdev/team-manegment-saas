"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Bookmark, Lock, MessageSquare, Pin, Plus, Trash2 } from "lucide-react";
import type { PostKind } from "@/lib/generated/prisma/client";
import {
  createDiscussionPostAction,
  createDiscussionTagAction,
  deleteDiscussionAction,
  deleteDiscussionMessageAction,
  fetchDiscussionPostsAction,
  fetchDiscussionTagsAction,
  fetchSavedDiscussionMessagesAction,
  setDiscussionMessageSavedAction,
  setDiscussionPinnedAction,
  type DiscussionTagView,
  type PostFeedView,
  type SavedDiscussionMessageView,
} from "@/lib/actions/discussion";
import { fetchWorkspaceMemberLabelsAction } from "@/lib/actions/workspace";
import { fetchWorkspaceLimitsAction } from "@/lib/actions/billing";
import type { ChatMessageView } from "@/lib/chat-message";
import type { ThreadMessageView } from "@/lib/post-thread";
import { POST_KIND_HINTS, POST_KIND_LABELS, POST_KINDS } from "@/lib/post-kind";
import { taskPath } from "@/lib/task-navigation";
import { UpdateCompose } from "@/components/board/update-compose";
import { PostMessageRow } from "@/components/discussion/post-message-row";
import { DiscussionTabs } from "@/components/discussion/discussion-tabs";
import {
  DiscussionFilterBar,
  discussionFilterPillCls,
  type DiscussionFilter,
  filterDiscussionPosts,
  filterEmptyLabel,
} from "@/components/discussion/discussion-filter-bar";
import { PostKindBadge } from "@/components/discussion/post-kind-badge";
import { TaskLinkPicker } from "@/components/discussion/task-link-picker";
import { Avatar, tagColor } from "@/components/ui/ui";
import { ui } from "@/components/ui/ui";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { bodyMentionsAgent, discussionMentionMembers, type MentionMember } from "@/lib/mentions";

type FeedTab = "discussions" | "saved";

function ComposeNewPost({
  members,
  currentUserId,
  workspaceId,
  workspaceTags,
  pending,
  onPost,
  onCancel,
}: {
  members: MentionMember[];
  currentUserId: string;
  workspaceId: string;
  workspaceTags: DiscussionTagView[];
  pending: boolean;
  onPost: (input: {
    body: string;
    kind: PostKind;
    taskShortId?: number;
    tags?: string[];
  }) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<PostKind>("DISCUSSION");
  const [linkedTaskShortId, setLinkedTaskShortId] = useState<number | null>(
    null
  );
  const [linkedTaskTitle, setLinkedTaskTitle] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  function toggleTag(slug: string) {
    setSelectedTags((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug]
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={ui.label}>Type</label>
        <div className="flex flex-wrap gap-2">
          {POST_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              title={POST_KIND_HINTS[option]}
              className={discussionFilterPillCls(kind === option)}
            >
              {POST_KIND_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
      {workspaceTags.length > 0 ? (
        <div>
          <label className={ui.label}>Tags</label>
          <div className="flex flex-wrap gap-2">
            {workspaceTags.map((tag) => {
              const selected = selectedTags.includes(tag.slug);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.slug)}
                  className={discussionFilterPillCls(selected)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div>
        <label className={ui.label}>Message</label>
        <UpdateCompose
        members={discussionMentionMembers(members, currentUserId)}
        value={draft}
        onChange={setDraft}
        onPost={() => {
          const body = draft.trim();
          if (!body || pending) return;
          onPost({
            body,
            kind,
            taskShortId: linkedTaskShortId ?? undefined,
            tags: selectedTags.length > 0 ? selectedTags : undefined,
          });
          setDraft("");
          setLinkedTaskShortId(null);
          setLinkedTaskTitle(null);
          setSelectedTags([]);
        }}
        pending={pending}
        placeholder="What do you want to discuss? (@euclis to ask the agent)"
        inputId="new-discussion-compose"
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label className={ui.label}>Link task</label>
          <p className={`${ui.fieldHint} mb-2`}>
            Optional — search by name or number
          </p>
          <TaskLinkPicker
            workspaceId={workspaceId}
            value={linkedTaskShortId}
            selectedTitle={linkedTaskTitle}
            onChange={(shortId, title) => {
              setLinkedTaskShortId(shortId);
              setLinkedTaskTitle(title);
            }}
            disabled={pending}
          />
        </div>
        <button type="button" onClick={onCancel} className={ui.btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function PostFeedCard({
  workspaceId,
  post,
  tagLabels,
  currentUserId,
  canManageDiscussions,
  onTogglePin,
  onDelete,
  pinning,
  deleting,
}: {
  workspaceId: string;
  post: PostFeedView;
  tagLabels: Map<string, string>;
  currentUserId: string;
  canManageDiscussions: boolean;
  onTogglePin: (post: PostFeedView) => void;
  onDelete: (post: PostFeedView) => void;
  pinning: boolean;
  deleting: boolean;
}) {
  const canDelete =
    canManageDiscussions || post.authorId === currentUserId;
  const headerActions = canManageDiscussions || canDelete;

  return (
    <div
      className={`relative rounded-xl border bg-paper/90 px-4 py-3 shadow-sm transition hover:border-ink/20 hover:bg-white dark:hover:bg-card-high ${
        post.pinned
          ? "border-amber-300/80 ring-1 ring-amber-200/60"
          : post.status === "RESOLVED"
            ? "border-line/60 bg-paper-deep/20"
            : "border-line/70"
      }`}
    >
      {headerActions ? (
        <div className="absolute right-3 top-3 flex items-center gap-1">
          {canDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDelete(post);
              }}
              disabled={deleting}
              title="Delete discussion"
              className="rounded-md p-1.5 text-ink-faint transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
          {canManageDiscussions ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onTogglePin(post);
              }}
              disabled={pinning}
              title={post.pinned ? "Unpin discussion" : "Pin discussion"}
              className={`rounded-md p-1.5 transition ${
                post.pinned
                  ? "text-amber-700 hover:bg-amber-50"
                  : "text-ink-faint hover:bg-paper-deep hover:text-ink"
              }`}
            >
              <Pin
                className="h-4 w-4"
                strokeWidth={2}
                fill={post.pinned ? "currentColor" : "none"}
              />
            </button>
          ) : null}
        </div>
      ) : null}
      <Link href={`/w/${workspaceId}/discussion/${post.id}`} className="block">
        <div className="flex items-start gap-3 pr-16">
          <Avatar seed={post.authorId} label={post.authorLabel} size="h-9 w-9 text-xs" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <PostKindBadge kind={post.kind} />
              {post.tags.map((slug) => (
                <span
                  key={slug}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tagColor(slug)}`}
                >
                  {tagLabels.get(slug) ?? slug}
                </span>
              ))}
              {post.pinned ? (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Pinned
                </span>
              ) : null}
              {post.status === "RESOLVED" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  <Lock className="h-3 w-3" strokeWidth={2} />
                  Closed
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-[15px] font-semibold text-ink">
                {post.title}
              </h3>
              <span className="text-xs text-ink-faint">
                {formatRelative(post.lastActivityAt)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{post.preview}</p>
            <p className="mt-2 text-xs text-ink-faint">
              {post.authorLabel}
              {post.replyCount > 0
                ? ` · ${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`
                : " · No replies yet"}
              {post.taskShortId
                ? ` · Linked to task #${post.taskShortId}`
                : ""}
            </p>
          </div>
        </div>
      </Link>
      {post.taskShortId ? (
        <Link
          href={taskPath(workspaceId, post.taskShortId)}
          className="mt-2 inline-flex text-xs font-medium text-ink-soft hover:text-ink"
          onClick={(event) => event.stopPropagation()}
        >
          View task #{post.taskShortId}
          {post.taskTitle ? `: ${post.taskTitle}` : ""}
        </Link>
      ) : null}
    </div>
  );
}

function SavedMessageCard({
  workspaceId,
  message,
  members,
  currentUserId,
  onReply,
  onToggleSave,
  onDelete,
}: {
  workspaceId: string;
  message: SavedDiscussionMessageView;
  members: MentionMember[];
  currentUserId: string;
  onReply: (message: ChatMessageView) => void;
  onToggleSave: (message: ChatMessageView) => void;
  onDelete: (message: ChatMessageView) => void;
}) {
  const threadMessage: ThreadMessageView = {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    authorId: message.authorId,
    authorLabel: message.authorLabel,
    parentMessageId: message.parentMessageId ?? null,
    mentionedLabels: message.mentionedLabels,
    saved: message.saved,
    isAgentGenerated: message.isAgentGenerated ?? false,
    isAgentPrivate: message.isAgentPrivate ?? false,
    agentTriggeredByLabel: message.agentTriggeredByLabel ?? null,
    depth: 0,
    replyToLabel: null,
  };

  return (
    <div className="rounded-xl border border-line/70 bg-paper/90 shadow-sm">
      <Link
        href={`/w/${workspaceId}/discussion/${message.postId}`}
        className="block border-b border-line/60 px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-white dark:hover:bg-white/5 hover:text-ink"
      >
        <span className="text-ink-faint">In </span>
        {message.postTitle}
      </Link>
      <div className="px-1 py-1">
        <PostMessageRow
          message={threadMessage}
          members={members}
          currentUserId={currentUserId}
          onReply={onReply}
          onToggleSave={onToggleSave}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function SavedEmptyState() {
  return (
    <div className="dashboard-panel flex flex-col items-center px-8 py-16 text-center">
      <div
        aria-hidden
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-deep/60 ring-1 ring-line/60"
      >
        <Bookmark className="h-6 w-6 text-ink-faint" strokeWidth={1.5} />
      </div>
      <p className="text-lg font-medium text-ink">No saved messages</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">
        Save messages from the menu on any discussion to find them here.
      </p>
    </div>
  );
}

function FilteredEmptyState({ filter }: { filter: DiscussionFilter }) {
  return (
    <div className="dashboard-panel flex flex-col items-center px-8 py-16 text-center">
      <div
        aria-hidden
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-deep/60 ring-1 ring-line/60"
      >
        <MessageSquare className="h-6 w-6 text-ink-faint" strokeWidth={1.5} />
      </div>
      <p className="text-lg font-medium text-ink">{filterEmptyLabel(filter)}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">
        Try another filter or start a new discussion.
      </p>
    </div>
  );
}

function DiscussionsEmptyState() {
  return (
    <div className="dashboard-panel flex flex-col items-center px-8 py-16 text-center">
      <div
        aria-hidden
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-deep/60 ring-1 ring-line/60"
      >
        <MessageSquare className="h-6 w-6 text-ink-faint" strokeWidth={1.5} />
      </div>
      <p className="text-lg font-medium text-ink">No discussions yet</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">
        Use discussions for team-wide conversation that isn&apos;t tied to a
        specific task.
      </p>
    </div>
  );
}

export function DiscussionFeed({
  workspaceId,
  currentUserId,
  canManageDiscussions = false,
}: {
  workspaceId: string;
  currentUserId: string;
  canManageDiscussions?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<FeedTab>("discussions");
  const [filter, setFilter] = useState<DiscussionFilter>({ type: "ALL" });
  const [workspaceTags, setWorkspaceTags] = useState<DiscussionTagView[]>([]);
  const [allPosts, setAllPosts] = useState<PostFeedView[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [savedMessages, setSavedMessages] = useState<SavedDiscussionMessageView[]>([]);
  const [members, setMembers] = useState<MentionMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [postPending, startPostTransition] = useTransition();
  const [, startActionTransition] = useTransition();
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [discussionCapReason, setDiscussionCapReason] = useState<string | null>(
    null
  );
  const [addingTag, startAddTag] = useTransition();
  const postsRequestRef = useRef(0);
  const hasPostsRef = useRef(false);

  const filteredPosts = useMemo(
    () => filterDiscussionPosts(allPosts, filter),
    [allPosts, filter]
  );

  const mentionOptions = useMemo(
    () => discussionMentionMembers(members, currentUserId),
    [members, currentUserId]
  );

  const tagLabels = useMemo(
    () => new Map(workspaceTags.map((tag) => [tag.slug, tag.name])),
    [workspaceTags]
  );

  const loadTags = useCallback(async () => {
    const result = await fetchDiscussionTagsAction(workspaceId);
    if (!result.error) setWorkspaceTags(result.tags);
  }, [workspaceId]);

  const refreshPosts = useCallback(async (silent = false) => {
    const requestId = ++postsRequestRef.current;
    if (!silent && !hasPostsRef.current) setPostsLoading(true);
    const result = await fetchDiscussionPostsAction(workspaceId);
    if (requestId !== postsRequestRef.current) return;
    setPostsLoading(false);
    if (result.error) {
      if (!silent || !hasPostsRef.current) setError(result.error);
      return;
    }
    setError(null);
    hasPostsRef.current = result.posts.length > 0;
    setAllPosts(result.posts);
  }, [workspaceId]);

  const refreshLimits = useCallback(async () => {
    const result = await fetchWorkspaceLimitsAction(workspaceId);
    if (result.status) {
      setDiscussionCapReason(
        result.status.atDiscussionCap
          ? `${result.status.planName} plan allows ${result.status.limits.maxOpenDiscussions} open discussions. Close one or upgrade to start another.`
          : null
      );
    }
  }, [workspaceId]);

  const loadSaved = useCallback(async () => {
    const result = await fetchSavedDiscussionMessagesAction(workspaceId);
    if (result.error) {
      // Saved tab is supplementary — don't block the discussions feed on failure.
      if (process.env.NODE_ENV !== "production") {
        console.error("[discussion feed] saved messages:", result.error);
      }
      return;
    }
    setSavedMessages(result.messages);
  }, [workspaceId]);

  useEffect(() => {
    hasPostsRef.current = false;
    setAllPosts([]);
    setPostsLoading(true);
    void refreshPosts();
    void loadSaved();
    void loadTags();
    void refreshLimits();
    fetchWorkspaceMemberLabelsAction(workspaceId).then(setMembers);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload feed when workspace changes
  }, [workspaceId]);

  const refreshPostsRef = useRef(refreshPosts);
  useEffect(() => {
    refreshPostsRef.current = refreshPosts;
  }, [refreshPosts]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const channel = supabase
      .channel(`discussion-feed-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Post",
          filter: `workspaceId=eq.${workspaceId}`,
        },
        () => {
          void refreshPostsRef.current(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "PostMessageSave",
          filter: `userId=eq.${currentUserId}`,
        },
        () => {
          void loadSaved();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, currentUserId, loadSaved]);

  function handleCreate(input: {
    body: string;
    kind: PostKind;
    taskShortId?: number;
    tags?: string[];
  }) {
    startPostTransition(async () => {
      const result = await createDiscussionPostAction(workspaceId, input.body, {
        kind: input.kind,
        taskShortId: input.taskShortId,
        tags: input.tags,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowCompose(false);
      void refreshLimits();
      if (result.postId) {
        const branch = bodyMentionsAgent(input.body) ? "?branchAgent=1" : "";
        router.push(`/w/${workspaceId}/discussion/${result.postId}${branch}`);
        return;
      }
      await refreshPosts();
    });
  }

  function handleFilterChange(next: DiscussionFilter) {
    setFilter(next);
  }

  function handleTogglePin(post: PostFeedView) {
    const nextPinned = !post.pinned;
    setPinningId(post.id);
    startActionTransition(async () => {
      const result = await setDiscussionPinnedAction(
        workspaceId,
        post.id,
        nextPinned
      );
      setPinningId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAllPosts((current) =>
        current
          .map((item) =>
            item.id === post.id
              ? { ...item, pinned: result.pinned ?? nextPinned }
              : item
          )
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return (
              new Date(b.lastActivityAt).getTime() -
              new Date(a.lastActivityAt).getTime()
            );
          })
      );
    });
  }

  function handleAddTag(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      startAddTag(async () => {
        const result = await createDiscussionTagAction(workspaceId, name);
        if (result.error) {
          setError(result.error);
          resolve(false);
          return;
        }
        if (result.tag) {
          setWorkspaceTags((current) => {
            if (current.some((tag) => tag.slug === result.tag!.slug)) {
              return current;
            }
            return [...current, result.tag!].sort((a, b) =>
              a.name.localeCompare(b.name)
            );
          });
          setFilter({ type: "TAG", slug: result.tag.slug });
        }
        setError(null);
        resolve(true);
      });
    });
  }

  function handleDeletePost(post: PostFeedView) {
    if (
      !window.confirm(
        "Delete this discussion and all its messages? This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingId(post.id);
    startActionTransition(async () => {
      const result = await deleteDiscussionAction(workspaceId, post.id);
      setDeletingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAllPosts((current) => current.filter((item) => item.id !== post.id));
      setSavedMessages((current) =>
        current.filter((item) => item.postId !== post.id)
      );
      setError(null);
      void refreshLimits();
    });
  }

  function handleReply(message: ChatMessageView) {
    const saved = message as SavedDiscussionMessageView;
    router.push(`/w/${workspaceId}/discussion/${saved.postId}`);
  }

  function handleToggleSave(message: ChatMessageView) {
    const saved = message as SavedDiscussionMessageView;
    const nextSaved = !saved.saved;
    startActionTransition(async () => {
      const result = await setDiscussionMessageSavedAction(
        workspaceId,
        saved.postId,
        saved.id,
        nextSaved
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      if (nextSaved) {
        setSavedMessages((current) =>
          current.some((item) => item.id === saved.id)
            ? current.map((item) =>
                item.id === saved.id
                  ? { ...item, saved: result.saved ?? nextSaved }
                  : item
              )
            : [...current, { ...saved, saved: result.saved ?? nextSaved }]
        );
        return;
      }
      setSavedMessages((current) =>
        current.filter((item) => item.id !== saved.id)
      );
    });
  }

  function handleDelete(message: ChatMessageView) {
    const saved = message as SavedDiscussionMessageView;
    if (!window.confirm("Delete this message? This cannot be undone.")) {
      return;
    }
    startActionTransition(async () => {
      const result = await deleteDiscussionMessageAction(
        workspaceId,
        saved.postId,
        saved.id
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedMessages((current) =>
        current.filter((item) => item.id !== saved.id)
      );
    });
  }

  return (
    <div className="space-y-4">
      <DiscussionTabs
        active={tab}
        onChange={(next) => {
          if (next !== tab) setTab(next);
        }}
        savedCount={savedMessages.length}
      />

      {tab === "discussions" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className={ui.mutedText}>
              Start a discussion for announcements, questions, and proposals —
              separate from task updates.
            </p>
            {!showCompose ? (
              <button
                type="button"
                onClick={() => setShowCompose(true)}
                disabled={Boolean(discussionCapReason)}
                title={discussionCapReason ?? undefined}
                className={`${ui.btnPrimary} shrink-0 gap-1.5`}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                New discussion
              </button>
            ) : null}
          </div>

          {discussionCapReason ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              {discussionCapReason}
            </div>
          ) : null}

          {showCompose ? (
            <div className="dashboard-panel">
              <ComposeNewPost
                members={members}
                currentUserId={currentUserId}
                workspaceId={workspaceId}
                workspaceTags={workspaceTags}
                pending={postPending}
                onPost={handleCreate}
                onCancel={() => setShowCompose(false)}
              />
            </div>
          ) : null}

          <DiscussionFilterBar
            active={filter}
            customTags={workspaceTags}
            onChange={handleFilterChange}
            onAddTag={handleAddTag}
            adding={addingTag}
          />

          {postsLoading && allPosts.length === 0 ? (
            <div className="dashboard-panel px-8 py-16 text-center text-sm text-ink-soft">
              Loading discussions…
            </div>
          ) : filteredPosts.length === 0 ? (
            allPosts.length === 0 ? (
              <DiscussionsEmptyState />
            ) : (
              <FilteredEmptyState filter={filter} />
            )
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredPosts.map((post) => (
                <li key={post.id}>
                  <PostFeedCard
                    workspaceId={workspaceId}
                    post={post}
                    tagLabels={tagLabels}
                    currentUserId={currentUserId}
                    canManageDiscussions={canManageDiscussions}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDeletePost}
                    pinning={pinningId === post.id}
                    deleting={deletingId === post.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : savedMessages.length === 0 ? (
        <SavedEmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {savedMessages.map((message) => (
            <li key={message.id}>
              <SavedMessageCard
                workspaceId={workspaceId}
                message={message}
                members={mentionOptions}
                currentUserId={currentUserId}
                onReply={handleReply}
                onToggleSave={handleToggleSave}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}

      {error ? <p className={ui.errorText}>{error}</p> : null}
    </div>
  );
}
