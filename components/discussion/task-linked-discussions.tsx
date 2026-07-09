"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { MessageSquare, Plus } from "lucide-react";
import type { PostKind } from "@/lib/generated/prisma/client";
import {
  createDiscussionPostAction,
  fetchTaskLinkedDiscussionsAction,
  type PostTaskLinkView,
} from "@/lib/actions/discussion";
import { PostKindBadge } from "@/components/discussion/post-kind-badge";
import { ui } from "@/components/ui/ui";
import { POST_KIND_LABELS, POST_KINDS } from "@/lib/post-kind";

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

export function TaskLinkedDiscussions({
  workspaceId,
  taskId,
  taskShortId,
}: {
  workspaceId: string;
  taskId: string;
  taskShortId: number;
}) {
  const [posts, setPosts] = useState<PostTaskLinkView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<PostKind>("DISCUSSION");
  const [pending, startTransition] = useTransition();

  const loadPosts = useCallback(async () => {
    const result = await fetchTaskLinkedDiscussionsAction(workspaceId, taskId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setPosts(result.posts);
  }, [workspaceId, taskId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  function handleCreate() {
    const body = draft.trim();
    if (!body || pending) return;
    startTransition(async () => {
      const result = await createDiscussionPostAction(workspaceId, body, {
        kind,
        taskShortId,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft("");
      setShowCompose(false);
      await loadPosts();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Linked discussions</h3>
          <p className={`${ui.fieldHint} mt-0.5`}>
            Broader team conversations tied to this task — separate from
            task-scoped updates.
          </p>
        </div>
        {!showCompose ? (
          <button
            type="button"
            onClick={() => setShowCompose(true)}
            className={`${ui.btnSecondary} shrink-0 gap-1.5`}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Start discussion
          </button>
        ) : null}
      </div>

      {showCompose ? (
        <div className="rounded-xl border border-line bg-paper/80 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {POST_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  kind === option
                    ? "bg-ink text-white"
                    : "bg-white text-ink-soft ring-1 ring-line hover:text-ink"
                }`}
              >
                {POST_KIND_LABELS[option]}
              </button>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What should the team discuss about this task?"
            rows={3}
            className={`${ui.input} min-h-[5rem] resize-y`}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCompose(false)}
              className={ui.btnSecondary}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || !draft.trim()}
              className={ui.btnPrimary}
            >
              {pending ? "Posting…" : "Post discussion"}
            </button>
          </div>
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-paper/50 px-4 py-8 text-center">
          <MessageSquare
            className="mx-auto mb-2 h-5 w-5 text-ink-faint"
            strokeWidth={1.5}
          />
          <p className="text-sm text-ink-soft">No linked discussions yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/w/${workspaceId}/discussion/${post.id}`}
                className="block rounded-xl border border-line/70 bg-white px-4 py-3 shadow-sm transition hover:border-ink/20"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PostKindBadge kind={post.kind} />
                  <span className="text-xs text-ink-faint">
                    {formatRelative(post.lastActivityAt)}
                  </span>
                </div>
                <p className="mt-1 font-medium text-ink">{post.title}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {post.authorLabel}
                  {post.replyCount > 0
                    ? ` · ${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className={ui.errorText}>{error}</p> : null}
    </div>
  );
}
