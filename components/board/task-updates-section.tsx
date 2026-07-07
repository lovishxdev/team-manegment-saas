"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  addTaskUpdateAction,
  fetchTaskUpdatesAction,
  type TaskUpdateView,
} from "@/lib/actions/workspace";
import { Avatar, ui } from "@/components/ui/ui";
import { ChatBubbleSkeleton } from "@/components/ui/loading";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function UpdateBubble({ update }: { update: TaskUpdateView }) {
  return (
    <div className="flex gap-2.5">
      <Avatar
        seed={update.authorId}
        label={update.authorLabel}
        size="h-8 w-8 text-xs"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-ink">
            {update.authorLabel}
          </span>
          <time
            className="text-[11px] text-ink-faint"
            dateTime={update.createdAt}
          >
            {formatWhen(update.createdAt)}
          </time>
        </div>
        <div className="rounded-2xl rounded-tl-md border border-line/70 bg-paper px-3 py-2 shadow-[0_1px_2px_rgba(26,26,26,0.04)]">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {update.body}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TaskUpdatesSection({
  workspaceId,
  taskId,
  taskShortId,
}: {
  workspaceId: string;
  taskId: string;
  taskShortId: number;
}) {
  const [updates, setUpdates] = useState<TaskUpdateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const result = await fetchTaskUpdatesAction(workspaceId, taskShortId);
    if (result.error) setError(result.error);
    setUpdates(result.updates);
    setLoading(false);
  }, [workspaceId, taskShortId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function connect() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      channel = supabase
        .channel(`task-updates-${taskId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "TaskUpdate",
            filter: `taskId=eq.${taskId}`,
          },
          () => {
            void load();
          }
        )
        .subscribe();
    }

    void connect();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [taskId, load]);

  function post() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await addTaskUpdateAction(
        workspaceId,
        taskShortId,
        body
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.update) {
        setUpdates((current) => [...current, result.update!]);
      }
      setDraft("");
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <ChatBubbleSkeleton count={3} />
        ) : updates.length === 0 ? (
          <p className="text-sm text-ink-faint">No updates yet.</p>
        ) : (
          updates.map((update) => (
            <UpdateBubble key={update.id} update={update} />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-line pt-4">
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Write an update…"
            className={`${ui.input} resize-y text-sm`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                post();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-ink-faint">
              ⌘/Ctrl+Enter to post
            </span>
            <button
              type="button"
              onClick={post}
              disabled={pending || !draft.trim()}
              className={ui.btnSecondary}
            >
              {pending ? "Posting…" : "Post update"}
            </button>
          </div>
        </div>

        {error ? <p className={`mt-2 ${ui.errorText}`}>{error}</p> : null}
      </div>
    </div>
  );
}
