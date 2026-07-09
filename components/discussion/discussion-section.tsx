"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bookmark, MessageSquare } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { ChatMessageView } from "@/lib/chat-message";
import { mentionableMembers, type MentionMember } from "@/lib/mentions";
import { UpdateCompose } from "@/components/board/update-compose";
import { UpdateMessageRow } from "@/components/board/update-message-row";
import { ui } from "@/components/ui/ui";
import { ChatBubbleSkeleton } from "@/components/ui/loading";

type DiscussionTab = "messages" | "saved";

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

function DiscussionTabs({
  active,
  onChange,
  savedCount,
}: {
  active: DiscussionTab;
  onChange: (tab: DiscussionTab) => void;
  savedCount: number;
}) {
  const tabCls = (tab: DiscussionTab) =>
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

function DiscussionEmptyState({
  tab,
  emptyMessagesHint,
  emptySavedHint,
}: {
  tab: DiscussionTab;
  emptyMessagesHint: string;
  emptySavedHint: string;
}) {
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
        {tab === "saved" ? emptySavedHint : emptyMessagesHint}
      </p>
    </div>
  );
}

function buildTimeline(messages: ChatMessageView[]) {
  const items: Array<
    | { type: "divider"; label: string; key: string }
    | { type: "message"; message: ChatMessageView }
  > = [];
  let lastDay: string | null = null;

  for (const message of messages) {
    const key = dayKey(message.createdAt);
    if (key !== lastDay) {
      items.push({
        type: "divider",
        label: formatDayDivider(message.createdAt),
        key: `day-${key}`,
      });
      lastDay = key;
    }
    items.push({ type: "message", message });
  }

  return items;
}

type ScrollSnapshot = {
  messagesEl: HTMLDivElement | null;
  messagesScrollTop: number;
  pageScrollY: number;
};

function captureScrollSnapshot(
  messagesRef: React.RefObject<HTMLDivElement | null>
): ScrollSnapshot {
  const messagesEl = messagesRef.current;
  return {
    messagesEl,
    messagesScrollTop: messagesEl?.scrollTop ?? 0,
    pageScrollY: window.scrollY,
  };
}

function restoreScrollSnapshot(snapshot: ScrollSnapshot) {
  requestAnimationFrame(() => {
    if (snapshot.messagesEl) {
      snapshot.messagesEl.scrollTop = snapshot.messagesScrollTop;
    }
    window.scrollTo(0, snapshot.pageScrollY);
  });
}

export type DiscussionSectionProps = {
  workspaceId: string;
  currentUserId: string;
  members: MentionMember[];
  realtime: {
    channelName: string;
    table: string;
    filter: string;
  };
  loadMessages: () => Promise<{ messages: ChatMessageView[]; error?: string }>;
  postMessage: (body: string) => Promise<{ message?: ChatMessageView; error?: string }>;
  deleteMessage: (id: string) => Promise<{ error?: string }>;
  toggleSaved: (id: string, saved: boolean) => Promise<{ saved?: boolean; error?: string }>;
  emptyMessagesHint?: string;
  emptySavedHint?: string;
  composePlaceholder?: string;
  deleteConfirm?: string;
  onReady?: () => void;
};

export function DiscussionSection({
  workspaceId,
  currentUserId,
  members,
  realtime,
  loadMessages,
  postMessage,
  deleteMessage,
  toggleSaved,
  emptyMessagesHint = "Share updates, questions, and context with your team.",
  emptySavedHint = "Save messages from the menu on any message to find them here.",
  composePlaceholder = "Share updates, questions, or context… (@ to mention)",
  deleteConfirm = "Delete this message? This cannot be undone.",
  onReady,
}: DiscussionSectionProps) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<DiscussionTab>("messages");
  const [error, setError] = useState<string | null>(null);
  const [postPending, startPostTransition] = useTransition();
  const [, startActionTransition] = useTransition();
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipRealtimeUntilRef = useRef(0);
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

  const savedMessages = useMemo(
    () => messages.filter((message) => message.saved),
    [messages]
  );

  const visibleMessages = tab === "saved" ? savedMessages : messages;
  const timeline = useMemo(() => buildTimeline(visibleMessages), [visibleMessages]);
  const timelineReversed = useMemo(() => [...timeline].reverse(), [timeline]);

  const load = useCallback(async (options?: { preserveScroll?: boolean }) => {
    const snapshot = options?.preserveScroll
      ? captureScrollSnapshot(messagesRef)
      : null;
    const result = await loadMessages();
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
    }
    setMessages(result.messages);
    setLoading(false);
    if (snapshot) restoreScrollSnapshot(snapshot);
  }, [loadMessages]);

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
        .channel(realtime.channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: realtime.table,
            filter: realtime.filter,
          },
          () => {
            if (Date.now() < skipRealtimeUntilRef.current) return;
            void load({ preserveScroll: true });
          }
        )
        .subscribe();
    }

    void connect();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [realtime.channelName, realtime.filter, realtime.table, load]);

  function post() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setDraft("");
    skipRealtimeUntilRef.current = Date.now() + 2500;
    const snapshot = captureScrollSnapshot(messagesRef);
    startPostTransition(async () => {
      const result = await postMessage(body);
      if (result.error) {
        setError(result.error);
        setDraft(body);
        restoreScrollSnapshot(snapshot);
        return;
      }
      if (result.message) {
        setMessages((current) => [...current, result.message!]);
      }
      restoreScrollSnapshot(snapshot);
      requestAnimationFrame(() => {
        textareaRef.current?.focus({ preventScroll: true });
      });
    });
  }

  function handleReply(message: ChatMessageView) {
    setTab("messages");
    const prefix =
      message.authorId === currentUserId ? "" : `@${message.authorLabel} `;
    setDraft((current) => {
      if (current.trim().length === 0) return prefix;
      return `${current.trimEnd()}\n\n${prefix}`;
    });
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    });
  }

  function handleToggleSave(message: ChatMessageView) {
    setError(null);
    const nextSaved = !message.saved;
    const snapshot = captureScrollSnapshot(messagesRef);

    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, saved: nextSaved } : item
      )
    );
    restoreScrollSnapshot(snapshot);

    startActionTransition(async () => {
      const result = await toggleSaved(message.id, nextSaved);
      if (result.error) {
        setError(result.error);
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id ? { ...item, saved: message.saved } : item
          )
        );
        restoreScrollSnapshot(snapshot);
        return;
      }
      const saved = result.saved ?? nextSaved;
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, saved } : item
        )
      );
      restoreScrollSnapshot(snapshot);
    });
  }

  function handleDelete(message: ChatMessageView) {
    if (!window.confirm(deleteConfirm)) {
      return;
    }
    setError(null);
    const snapshot = captureScrollSnapshot(messagesRef);
    startActionTransition(async () => {
      const result = await deleteMessage(message.id);
      if (result.error) {
        setError(result.error);
        restoreScrollSnapshot(snapshot);
        return;
      }
      setMessages((current) => current.filter((item) => item.id !== message.id));
      restoreScrollSnapshot(snapshot);
    });
  }

  return (
    <section className={`${ui.contentPanel} ${ui.chatShell} !p-0`}>
      <div className="shrink-0 border-b border-line px-4 pt-4 sm:px-5 sm:pt-5">
        <DiscussionTabs
          active={tab}
          onChange={setTab}
          savedCount={savedMessages.length}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-5">
        <div
          ref={messagesRef}
          className="updates-scroll flex min-h-0 flex-1 flex-col-reverse gap-3 overflow-y-auto overscroll-contain py-3 [overflow-anchor:none]"
        >
          {loading ? (
            <ChatBubbleSkeleton count={2} />
          ) : visibleMessages.length === 0 ? (
            <DiscussionEmptyState
              tab={tab}
              emptyMessagesHint={emptyMessagesHint}
              emptySavedHint={emptySavedHint}
            />
          ) : (
            <div className="flex flex-col-reverse gap-3">
              {timelineReversed.map((item) =>
                item.type === "divider" ? (
                  <DayDivider key={item.key} label={item.label} />
                ) : (
                  <UpdateMessageRow
                    key={item.message.id}
                    message={item.message}
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
          <div className="shrink-0 border-t border-line bg-white py-3">
            <UpdateCompose
              members={mentionOptions}
              value={draft}
              onChange={setDraft}
              onPost={post}
              pending={postPending}
              textareaRef={textareaRef}
              placeholder={composePlaceholder}
              inputId={`discussion-compose-${workspaceId}`}
              className="relative mt-0"
            />
          </div>
        ) : null}

        {error ? <p className={`shrink-0 pb-3 ${ui.errorText}`}>{error}</p> : null}
      </div>
    </section>
  );
}
