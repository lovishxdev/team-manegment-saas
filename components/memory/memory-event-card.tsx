"use client";

import { OpenTaskLink } from "@/components/board/open-task-link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMemoryDocumentAction,
  resolveMemoryEventAction,
  submitMemoryFeedbackAction,
  type MemoryEventView,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { formatDayMonthYear } from "@/lib/format-date";
import type { MemoryFeedbackReason } from "@/lib/generated/prisma/client";

const KIND_STYLES: Record<string, string> = {
  DECISION: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  BLOCKER: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  DEPENDENCY:
    "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  MILESTONE:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  INSIGHT: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
};

const KIND_LABELS: Record<string, string> = {
  DECISION: "Decision",
  BLOCKER: "Blocker",
  DEPENDENCY: "Dependency",
  MILESTONE: "Milestone",
  INSIGHT: "Insight",
};

const chipCls =
  "inline-flex h-[22px] items-center rounded px-2 font-mono text-[10px] font-medium leading-none tracking-wide";

const cardCls =
  "rounded-xl border border-line bg-card px-4 py-4 shadow-[0_1px_3px_rgba(26,26,26,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_4px_12px_rgba(26,26,26,0.06)]";

export function MemoryEventCard({
  workspaceId,
  event,
  showTaskLink = true,
  canCurate = false,
}: {
  workspaceId: string;
  event: MemoryEventView;
  showTaskLink?: boolean;
  canCurate?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolvedLocally, setResolvedLocally] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

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

  function submitFeedback(reason: MemoryFeedbackReason) {
    setError(null);
    startTransition(async () => {
      const result = await submitMemoryFeedbackAction(
        workspaceId,
        event.id,
        reason
      );
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  async function toggleSource() {
    if (showSource) {
      setShowSource(false);
      return;
    }
    if (!event.sourceDocument) return;
    if (sourceContent !== null) {
      setShowSource(true);
      return;
    }

    setSourceLoading(true);
    setError(null);
    const result = await fetchMemoryDocumentAction(
      workspaceId,
      event.sourceDocument.id
    );
    setSourceLoading(false);
    if (result.error || result.content === null) {
      setError(result.error ?? "Memory document could not be loaded");
      return;
    }
    setSourceContent(result.content);
    setShowSource(true);
  }

  return (
    <article className={cardCls}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${chipCls} ${KIND_STYLES[event.kind] ?? "bg-paper-deep text-ink-soft"}`}>
          {KIND_LABELS[event.kind] ?? event.kind}
        </span>
        {isBlockerLike && (
          <span
            className={`${chipCls} ${
              isOpen
                ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
            }`}
          >
            {isOpen ? "Open" : "Resolved"}
          </span>
        )}
        {!event.reviewed && (
          <span
            className={`${chipCls} border border-dashed border-line bg-transparent text-ink-faint`}
            title="Captured but not yet curated by the nightly memory review"
          >
            Unreviewed
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-faint">
          {formatDayMonthYear(event.createdAt)}
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
      {event.sourceDocument && (
        <button
          type="button"
          onClick={toggleSource}
          disabled={sourceLoading}
          aria-expanded={showSource}
          className="mt-2 font-mono text-[11px] text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          {sourceLoading
            ? "Loading source"
            : showSource
              ? "Hide source"
              : "Preview source"}{" "}
          ·{" "}
          {event.sourceDocument.path}
        </button>
      )}
      {!event.sourceDocument && event.sourceDocumentPath && (
        <p className="mt-2 font-mono text-[11px] text-ink-faint">
          Source: {event.sourceDocumentPath}
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
      {showSource && event.sourceDocument && (
        <div className="mt-3 rounded-lg border border-line bg-paper-deep/45 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-2">
            <div>
              <p className="text-xs font-medium text-ink">
                {event.sourceDocument.title}
              </p>
              <p className="font-mono text-[10px] text-ink-faint">
                {event.sourceDocument.path}
              </p>
            </div>
            <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
              {event.sourceDocument.currentVersion
                ? "Current snapshot"
                : "Source updated since capture"}
            </span>
          </div>
          <MarkdownContent source={sourceContent ?? ""} />
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
        {canCurate && !isOpen && (
          <details className="relative ml-auto">
            <summary className="cursor-pointer list-none font-mono text-[11px] text-ink-faint hover:text-ink">
              Memory feedback
            </summary>
            <div className="absolute bottom-6 right-0 z-10 w-40 rounded-lg border border-line bg-card p-1.5 shadow-lg">
              {[
                ["NOT_USEFUL", "Not useful"],
                ["WRONG_SCOPE", "Wrong scope"],
                ["DUPLICATE", "Duplicate"],
              ].map(([reason, label]) => (
                <button
                  key={reason}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    submitFeedback(reason as MemoryFeedbackReason)
                  }
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-ink-soft hover:bg-paper-deep hover:text-ink"
                >
                  {label}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
      {error ? <p className={`mt-3 ${ui.errorText}`}>{error}</p> : null}
    </article>
  );
}
