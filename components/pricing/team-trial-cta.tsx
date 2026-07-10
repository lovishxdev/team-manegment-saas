"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  fetchTrialEligibleWorkspacesAction,
  startTeamTrialAction,
} from "@/lib/actions/billing";
import type { TrialEligibleWorkspace } from "@/lib/billing/entitlements";

const CTA_LABEL = "Start free 14-day trial";

export function TeamTrialCta({
  isAuthed,
  className = "",
}: {
  isAuthed: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [workspaces, setWorkspaces] = useState<TrialEligibleWorkspace[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  if (!isAuthed) {
    return (
      <Link
        href="/login?next=/pricing"
        className={className}
      >
        {CTA_LABEL}
      </Link>
    );
  }

  function loadWorkspaces() {
    setError(null);
    startTransition(async () => {
      const result = await fetchTrialEligibleWorkspacesAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setWorkspaces(result.workspaces ?? []);
    });
  }

  function startTrial(workspaceId: string) {
    setError(null);
    setStartingId(workspaceId);
    startTransition(async () => {
      const result = await startTeamTrialAction(workspaceId);
      if (result.error) {
        setError(result.error);
        setStartingId(null);
        return;
      }
      router.push(`/w/${workspaceId}`);
    });
  }

  // Step 1: initial button — fetch eligible workspaces.
  if (workspaces === null) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={loadWorkspaces}
          disabled={pending}
          className={className}
        >
          {pending ? "Loading…" : CTA_LABEL}
        </button>
        {error ? (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        ) : null}
      </div>
    );
  }

  const eligible = workspaces.filter((w) => w.eligible);

  // No workspaces to trial at all.
  if (workspaces.length === 0) {
    return (
      <div className="w-full text-center">
        <Link href="/dashboard" className={className}>
          Create a workspace
        </Link>
        <p className="mt-2 text-xs text-ink-faint">
          Create a workspace, then start your trial from here.
        </p>
      </div>
    );
  }

  // Has workspaces, but none eligible (all trialed or already paid).
  if (eligible.length === 0) {
    return (
      <div className="w-full text-center">
        <span
          className={`${className} pointer-events-none opacity-50`}
          aria-disabled
        >
          {CTA_LABEL}
        </span>
        <p className="mt-2 text-xs text-ink-faint">
          All your workspaces have already used their trial or are on a paid
          plan.
        </p>
      </div>
    );
  }

  // Step 2: pick which workspace to start the trial on.
  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-medium text-ink-soft">
        Start the trial on:
      </p>
      <div className="flex flex-col gap-2">
        {eligible.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            onClick={() => startTrial(workspace.id)}
            disabled={pending}
            className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink transition hover:border-ink/30 hover:bg-white disabled:opacity-60"
          >
            <span className="truncate">{workspace.name}</span>
            <span className="ml-2 shrink-0 text-xs text-ink-faint">
              {startingId === workspace.id ? "Starting…" : "Start →"}
            </span>
          </button>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
