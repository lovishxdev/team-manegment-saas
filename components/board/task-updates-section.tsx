"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  addTaskUpdateAction,
  fetchTaskUpdatesAction,
  type TaskUpdateView,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

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
    <div>
      <label className={ui.label}>Updates</label>
      <p className="mb-2 text-xs text-ink-faint">
        Blockers, questions, and review notes for this task — separate from the
        description.
      </p>

      <div className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-line bg-paper p-2.5">
        {loading ? (
          <p className="text-xs text-ink-faint">Loading…</p>
        ) : updates.length === 0 ? (
          <p className="text-xs text-ink-faint">
            No updates yet. Post a blocker or question for the team.
          </p>
        ) : (
          updates.map((u) => (
            <div
              key={u.id}
              className="rounded-md border border-line/60 bg-card px-2.5 py-2"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-ink-faint">
                <span className="font-medium text-ink-soft">
                  {u.authorLabel}
                </span>
                <time dateTime={u.createdAt}>{formatWhen(u.createdAt)}</time>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{u.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="e.g. Blocked on staging migration — need DB access"
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

      {error && <p className={`mt-2 ${ui.errorText}`}>{error}</p>}
    </div>
  );
}
