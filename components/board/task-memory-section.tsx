"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  fetchTaskMemoryAction,
  type MemoryEventView,
} from "@/lib/actions/workspace";
import { MemoryEventCard } from "@/components/memory/memory-event-card";
import { MemoryListSkeleton } from "@/components/ui/loading";
import { ui } from "@/components/ui/ui";

/**
 * Task page "Memory" tab: this task's captured decisions/blockers.
 */
export function TaskMemorySection({
  workspaceId,
  taskId,
  taskShortId,
}: {
  workspaceId: string;
  taskId: string;
  taskShortId: number;
}) {
  const [events, setEvents] = useState<MemoryEventView[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchTaskMemoryAction(workspaceId, taskShortId);
    if (!result.error) setEvents(result.events);
    setLoaded(true);
  }, [workspaceId, taskShortId]);

  useEffect(() => {
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
        .channel(`task-memory-${taskId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "MemoryEvent",
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

  if (!loaded) {
    return (
      <div className={ui.contentPanel}>
        <MemoryListSkeleton count={2} />
      </div>
    );
  }

  const openCount = events.filter((e) => e.status === "OPEN").length;

  return (
    <div className={ui.contentPanel}>
      <div className="mb-5 flex flex-wrap items-baseline gap-2">
        <h2 className={ui.settingsSectionTitle}>Memory</h2>
        {openCount > 0 ? (
          <span className="inline-flex h-[22px] items-center rounded px-2 font-mono text-[10px] font-medium leading-none tracking-wide bg-rose-50 text-rose-700">
            {openCount} open
          </span>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p className={ui.fieldHint}>No memory captured for this task yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <MemoryEventCard
              key={event.id}
              workspaceId={workspaceId}
              event={event}
              showTaskLink={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
