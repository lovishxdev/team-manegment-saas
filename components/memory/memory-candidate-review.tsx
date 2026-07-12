"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  promoteMemoryCandidateAction,
  rejectMemoryCandidateAction,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

export type MemoryCandidateViewModel = {
  id: string;
  kind: string;
  scope: string;
  authority: string;
  summary: string;
  reasoning: string | null;
  evidenceQuote: string | null;
  tags: string[];
  durabilityScore: number;
  coordinationScore: number;
  criticReason: string | null;
  createdAt: string;
  task: { shortId: number; title: string } | null;
  sourceDocument: { path: string; title: string } | null;
};

export function MemoryCandidateReview({
  candidates,
}: {
  candidates: MemoryCandidateViewModel[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function act(candidateId: string, action: "promote" | "reject") {
    setActiveId(candidateId);
    setError(null);
    startTransition(async () => {
      const result =
        action === "promote"
          ? await promoteMemoryCandidateAction(candidateId)
          : await rejectMemoryCandidateAction(candidateId);
      setActiveId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (candidates.length === 0) return null;

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => (
        <article
          key={candidate.id}
          className="rounded-xl border border-dashed border-line-strong bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-violet-50 px-2 py-1 font-mono text-[10px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
              Candidate · {candidate.kind}
            </span>
            <span className="rounded bg-paper-deep px-2 py-1 font-mono text-[10px] text-ink-soft">
              {candidate.scope.toLowerCase()}
            </span>
            <span className="rounded bg-paper-deep px-2 py-1 font-mono text-[10px] text-ink-soft">
              {candidate.authority.toLowerCase().replaceAll("_", " ")}
            </span>
            <span className="rounded bg-paper-deep px-2 py-1 font-mono text-[10px] text-ink-soft">
              durability {candidate.durabilityScore}
            </span>
            <span className="rounded bg-paper-deep px-2 py-1 font-mono text-[10px] text-ink-soft">
              coordination {candidate.coordinationScore}
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-ink">
            {candidate.summary}
          </p>
          {candidate.reasoning && (
            <p className="mt-1 text-sm text-ink-soft">{candidate.reasoning}</p>
          )}
          {candidate.evidenceQuote && (
            <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-xs italic text-ink-soft">
              “{candidate.evidenceQuote}”
            </blockquote>
          )}
          {candidate.criticReason && (
            <p className="mt-2 text-xs text-ink-faint">
              Critic: {candidate.criticReason}
            </p>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(candidate.id, "reject")}
              className={`${ui.btnSecondary} !min-h-0 !px-3 !py-1.5 text-xs`}
            >
              {pending && activeId === candidate.id ? "Working…" : "Not useful"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(candidate.id, "promote")}
              className={`${ui.btnPrimary} !min-h-0 !px-3 !py-1.5 text-xs`}
            >
              Keep in memory
            </button>
          </div>
        </article>
      ))}
      {error && <p className={ui.errorText}>{error}</p>}
    </div>
  );
}
