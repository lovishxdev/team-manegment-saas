"use client";

import { useState, useTransition } from "react";
import {
  deleteWorkspaceAction,
  leaveWorkspaceAction,
} from "@/lib/actions/workspace";

export function DangerZone({
  workspaceId,
  workspaceName,
  isLeader,
}: {
  workspaceId: string;
  workspaceName: string;
  isLeader: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function leave() {
    if (!window.confirm(`Leave "${workspaceName}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await leaveWorkspaceAction(workspaceId);
      if (result?.error) setError(result.error);
    });
  }

  function destroy() {
    const answer = window.prompt(
      `This permanently deletes "${workspaceName}" and ALL its tasks, assets and invites. Type the workspace name to confirm:`
    );
    if (answer !== workspaceName) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteWorkspaceAction(workspaceId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-5">
      <h2 className="text-sm font-medium text-red-300">Danger zone</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={leave}
          disabled={pending}
          className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-60"
        >
          Leave workspace
        </button>
        {isLeader && (
          <button
            onClick={destroy}
            disabled={pending}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
          >
            Delete workspace
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
