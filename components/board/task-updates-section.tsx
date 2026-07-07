"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bookmark, MessageSquare } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  addTaskUpdateAction,
  deleteTaskUpdateAction,
  fetchTaskUpdatesAction,
  setTaskUpdateSavedAction,
  type TaskUpdateView,
} from "@/lib/actions/workspace";
import { mentionableMembers, type MentionMember } from "@/lib/mentions";
import { UpdateCompose } from "@/components/board/update-compose";
import { UpdateMessageRow } from "@/components/board/update-message-row";
import { ui } from "@/components/ui/ui";
import { ChatBubbleSkeleton } from "@/components/ui/loading";

type UpdatesTab = "messages" | "saved";

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, now)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="relative py-3" role="separator">
      <div className="absolute inset-x-0 top-1/2 border-t border-line" />
      <span className="relative mx-auto block w-fit bg-white px-3 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </span>
    </div>
  );
}

function UpdatesTabs({
  active,
  onChange,
  savedCount,
}: {
  active: UpdatesTab;
  onChange: (tab: UpdatesTab) => void;
  savedCount: number;
}) {
  const tabCls = (tab: UpdatesTab) =>
    `relative pb-3 text-[15px] font-semibold transition-colors ${
      active === tab
        ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink"
        : "text-ink-faint hover:text-ink-soft"
    }`;

  return (
    <div className="mb-4 flex gap-6 border-b border-line">
      <button type="button" onClick={() => onChange("messages")} className={tabCls("messages")}>
        Messages
      </button>
      <button type="button" onClick={() => onChange("saved")} className={tabCls("saved")}>
        Saved{savedCount > 0 ? ` (${savedCount})` : ""}
      </button>
    </div>
  );
}

function UpdatesEmptyState({ tab }: { tab: UpdatesTab }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
        {tab === "saved" ? (
          <Bookmark className="h-5 w-5" strokeWidth={1.75} />
        ) : (
          <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
        )}
      </div>
      <p className="text-sm font-medium text-ink">
        {tab === "saved" ? "No saved messages" : "No messages yet"}
      </p>
      <p className="mt-1 max-w-xs text-sm text-ink-faint">
        {tab === "saved"
          ? "Save updates from the menu on any message to find them here."
          : "Share progress, blockers, and context with your team."}
      </p>
    </div>
  );
}

function buildTimeline(updates: TaskUpdateView[]) {
  const items: Array<
    | { type: "divider"; label: string; key: string }
    | { type: "update"; update: TaskUpdateView }
  > = [];
  let lastDay: string | null = null;

  for (const update of updates) {
    const key = dayKey(update.createdAt);
    if (key !== lastDay) {
      items.push({
        type: "divider",
        label: formatDayDivider(update.createdAt),
        key: `day-${key}`,
      });
      lastDay = key;
    }
    items.push({ type: "update", update });
  }

  return items;
}

export function TaskUpdatesSection({
  workspaceId,
  taskId,
  taskShortId,
  currentUserId,
  members,
  onReady,
}: {
  workspaceId: string;
  taskId: string;
  taskShortId: number;
  currentUserId: string;
  members: MentionMember[];
  /** Fires once after the first updates fetch finishes (layout is stable). */
  onReady?: () => void;
}) {
  const [updates, setUpdates] = useState<TaskUpdateView[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<UpdatesTab>("messages");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onReadyRef = useRef(onReady);
  const readyFired = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (loading || readyFired.current) return;
    readyFired.current = true;
    onReadyRef.current?.();
  }, [loading]);

  const mentionOptions = useMemo(
    () => mentionableMembers(members, currentUserId),
    [members, currentUserId]
  );

  const savedUpdates = useMemo(
    () => updates.filter((update) => update.saved),
    [updates]
  );

  const visibleUpdates = tab === "saved" ? savedUpdates : updates;
  const timeline = useMemo(() => buildTimeline(visibleUpdates), [visibleUpdates]);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const load = useCallback(async () => {
    const result = await fetchTaskUpdatesAction(workspaceId, taskShortId);
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
    }
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

  useEffect(() => {
    if (loading || tab !== "messages") return;
    requestAnimationFrame(() => scrollMessagesToBottom("auto"));
  }, [loading, updates.length, tab, scrollMessagesToBottom]);

  function post() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await addTaskUpdateAction(workspaceId, taskShortId, body);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.update) {
        setUpdates((current) => [...current, result.update!]);
        requestAnimationFrame(() => scrollMessagesToBottom());
      }
      setDraft("");
      textareaRef.current?.focus();
    });
  }

  function handleReply(update: TaskUpdateView) {
    setTab("messages");
    const prefix =
      update.authorId === currentUserId ? "" : `@${update.authorLabel} `;
    setDraft((current) => {
      if (current.trim().length === 0) return prefix;
      return `${current.trimEnd()}\n\n${prefix}`;
    });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    });
  }

  function handleToggleSave(update: TaskUpdateView) {
    setError(null);
    const nextSaved = !update.saved;
    startTransition(async () => {
      const result = await setTaskUpdateSavedAction(
        workspaceId,
        update.id,
        nextSaved
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setUpdates((current) =>
        current.map((item) =>
          item.id === update.id
            ? { ...item, saved: result.saved ?? nextSaved }
            : item
        )
      );
    });
  }

  function handleDelete(update: TaskUpdateView) {
    if (
      !window.confirm("Delete this update? This cannot be undone.")
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteTaskUpdateAction(workspaceId, update.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUpdates((current) => current.filter((item) => item.id !== update.id));
    });
  }

  return (
    <section className={ui.contentPanel}>
      <UpdatesTabs
        active={tab}
        onChange={setTab}
        savedCount={savedUpdates.length}
      />

      <div
        ref={messagesRef}
        className="updates-scroll max-h-[min(28rem,calc(100dvh-18rem))] min-h-[12rem] space-y-3 overflow-y-auto overscroll-contain"
      >
        {loading ? (
          <ChatBubbleSkeleton count={3} />
        ) : visibleUpdates.length === 0 ? (
          <UpdatesEmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            {timeline.map((item) =>
              item.type === "divider" ? (
                <DayDivider key={item.key} label={item.label} />
              ) : (
                <UpdateMessageRow
                  key={item.update.id}
                  update={item.update}
                  members={members}
                  currentUserId={currentUserId}
                  onReply={handleReply}
                  onToggleSave={handleToggleSave}
                  onDelete={handleDelete}
                />
              )
            )}
          </div>
        )}
      </div>

      {tab === "messages" ? (
        <UpdateCompose
          members={mentionOptions}
          value={draft}
          onChange={setDraft}
          onPost={post}
          pending={pending}
          textareaRef={textareaRef}
        />
      ) : null}

      {error ? <p className={`mt-3 ${ui.errorText}`}>{error}</p> : null}
    </section>
  );
}
