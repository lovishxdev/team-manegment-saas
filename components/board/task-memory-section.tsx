"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import {
  fetchTaskMemoryAction,
  type MemoryEventView,
} from "@/lib/actions/workspace";
import { MemoryEventCard } from "@/components/memory/memory-event-card";
import { ui } from "@/components/ui/ui";

/**
 * Task-modal "Memory" section: this task's captured decisions/blockers with
 * an open-blocker badge. Hidden entirely while the task has no memory —
 * memory is quiet by design.
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

  if (!loaded || events.length === 0) return null;

  const openCount = events.filter((e) => e.status === "OPEN").length;

  return (
    <div>
      <label className={ui.label}>
        Memory
        {openCount > 0 && (
          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            {openCount} open blocker{openCount === 1 ? "" : "s"}
          </span>
        )}
      </label>
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
        {events.map((event) => (
          <MemoryEventCard
            key={event.id}
            workspaceId={workspaceId}
            event={event}
            showTaskLink={false}
          />
        ))}
      </div>
    </div>
  );
}
