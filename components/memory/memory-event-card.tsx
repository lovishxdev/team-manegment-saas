"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resolveMemoryEventAction,
  type MemoryEventView,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

const KIND_STYLES: Record<string, string> = {
  DECISION: "bg-sky-100 text-sky-700",
  BLOCKER: "bg-red-100 text-red-700",
  DEPENDENCY: "bg-amber-100 text-amber-700",
  MILESTONE: "bg-emerald-100 text-emerald-700",
};

const KIND_LABELS: Record<string, string> = {
  DECISION: "Decision",
  BLOCKER: "Blocker",
  DEPENDENCY: "Dependency",
  MILESTONE: "Milestone",
};

function formatDate(iso: string): string {
  // Explicit locale so the server and browser render the same string
  // (a mismatch like "Jul 5" vs "5 Jul" breaks React hydration).
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MemoryEventCard({
  workspaceId,
  event,
  showTaskLink = true,
}: {
  workspaceId: string;
  event: MemoryEventView;
  showTaskLink?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOpen = event.status === "OPEN";
  const canResolve =
    isOpen && (event.kind === "BLOCKER" || event.kind === "DEPENDENCY");

  function resolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveMemoryEventAction(workspaceId, event.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div
      className={`rounded-xl border bg-paper p-4 shadow-[0_1px_3px_rgba(26,26,26,0.04)] transition-[border-color,box-shadow] duration-200 hover:shadow-[0_4px_16px_rgba(26,26,26,0.06)] ${
        isOpen ? "border-red-200" : "border-line hover:border-line-strong"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${KIND_STYLES[event.kind] ?? "bg-paper-deep text-ink-soft"}`}
        >
          {KIND_LABELS[event.kind] ?? event.kind}
        </span>
        {(event.kind === "BLOCKER" || event.kind === "DEPENDENCY") && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isOpen
                ? "bg-red-50 text-red-600"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isOpen ? "Open" : "Resolved"}
          </span>
        )}
        <span className="ml-auto text-xs text-ink-faint">
          {formatDate(event.createdAt)}
          {event.authorLabel ? ` · @${event.authorLabel}` : ""}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium text-ink">{event.summary}</p>
      {event.reasoning && (
        <p className="mt-1 text-sm text-ink-soft">{event.reasoning}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {showTaskLink && event.task && (
          <Link
            href={`/w/${workspaceId}?task=${event.task.shortId}`}
            className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            #{event.task.shortId} {event.task.title}
          </Link>
        )}
        {canResolve && (
          <button
            onClick={resolve}
            disabled={pending}
            aria-busy={pending}
            className="ml-auto rounded-md border border-line-strong px-2.5 py-1 text-xs text-ink-soft transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-60"
          >
            {pending ? "Resolving…" : "Mark resolved"}
          </button>
        )}
      </div>
      {error && <p className={`mt-2 ${ui.errorText}`}>{error}</p>}
    </div>
  );
}
