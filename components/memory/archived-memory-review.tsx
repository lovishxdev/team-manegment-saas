"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreArchivedMemoryEventAction } from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

export type ArchivedMemoryView = {
  id: string;
  kind: string;
  summary: string;
  archiveReason: string | null;
  archivedAt: string | null;
};

export function ArchivedMemoryReview({
  events,
}: {
  events: ArchivedMemoryView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function restore(eventId: string) {
    setActiveId(eventId);
    setError(null);
    startTransition(async () => {
      const result = await restoreArchivedMemoryEventAction(eventId);
      setActiveId(null);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (events.length === 0) return null;
  return (
    <details className="rounded-xl border border-line bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
        Archived memory ({events.length} recent)
      </summary>
      <div className="divide-y divide-line/60 border-t border-line px-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{event.summary}</p>
              <p className="mt-1 line-clamp-2 text-xs text-ink-faint">
                {event.archiveReason ?? "Archived by memory curation"}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => restore(event.id)}
              className={`${ui.btnSecondary} self-start !min-h-0 !px-3 !py-1.5 text-xs`}
            >
              {pending && activeId === event.id ? "Restoring…" : "Restore"}
            </button>
          </div>
        ))}
        {error && <p className={`py-3 ${ui.errorText}`}>{error}</p>}
      </div>
    </details>
  );
}
