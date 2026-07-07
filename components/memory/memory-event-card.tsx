"use client";

import { OpenTaskLink } from "@/components/board/open-task-link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resolveMemoryEventAction,
  type MemoryEventView,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

const KIND_STYLES: Record<string, string> = {
  DECISION: "bg-sky-50 text-sky-700",
  BLOCKER: "bg-rose-50 text-rose-700",
  DEPENDENCY: "bg-amber-50 text-amber-800",
  MILESTONE: "bg-emerald-50 text-emerald-700",
};

const KIND_LABELS: Record<string, string> = {
  DECISION: "Decision",
  BLOCKER: "Blocker",
  DEPENDENCY: "Dependency",
  MILESTONE: "Milestone",
};

const chipCls =
  "inline-flex h-[22px] items-center rounded px-2 font-mono text-[10px] font-medium leading-none tracking-wide";

const cardCls =
  "rounded-xl border border-line bg-white px-4 py-4 shadow-[0_1px_3px_rgba(26,26,26,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_4px_12px_rgba(26,26,26,0.06)]";

function formatDate(iso: string): string {
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
  const [resolvedLocally, setResolvedLocally] = useState(false);

  const isOpen = event.status === "OPEN" && !resolvedLocally;
  const canResolve =
    isOpen && (event.kind === "BLOCKER" || event.kind === "DEPENDENCY");
  const isBlockerLike =
    event.kind === "BLOCKER" || event.kind === "DEPENDENCY";

  function resolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveMemoryEventAction(workspaceId, event.id);
      if (result.error) {
        setError(result.error);
      } else {
        setResolvedLocally(true);
        router.refresh();
      }
    });
  }

  return (
    <article
      className={`${cardCls} ${
        isOpen && isBlockerLike
          ? "border-l-[3px] border-l-rose-400"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chipCls} ${KIND_STYLES[event.kind] ?? "bg-paper-deep text-ink-soft"}`}>
          {KIND_LABELS[event.kind] ?? event.kind}
        </span>
        {isBlockerLike && (
          <span
            className={`${chipCls} ${
              isOpen
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isOpen ? "Open" : "Resolved"}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-faint">
          {formatDate(event.createdAt)}
          {event.authorLabel ? ` · @${event.authorLabel}` : ""}
        </span>
      </div>

      <p className="mt-3 text-[15px] font-medium leading-snug text-ink">
        {event.summary}
      </p>
      {event.reasoning && (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          {event.reasoning}
        </p>
      )}
      {event.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {event.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-soft"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {showTaskLink && event.task && (
          <OpenTaskLink
            workspaceId={workspaceId}
            shortId={event.task.shortId}
            className="font-mono text-[11px] text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            #{event.task.shortId} {event.task.title}
          </OpenTaskLink>
        )}
        {canResolve && (
          <button
            type="button"
            onClick={resolve}
            disabled={pending}
            aria-busy={pending}
            className={`${ui.btnSecondary} ml-auto !min-h-0 !px-3 !py-1.5 text-xs`}
          >
            {pending ? "Resolving…" : "Mark resolved"}
          </button>
        )}
      </div>
      {error ? <p className={`mt-3 ${ui.errorText}`}>{error}</p> : null}
    </article>
  );
}
