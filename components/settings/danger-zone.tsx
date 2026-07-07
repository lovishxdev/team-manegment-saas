"use client";

import { useState, useTransition } from "react";
import {
  deleteWorkspaceAction,
  leaveWorkspaceAction,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

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
    <section className="rounded-xl border border-red-200 bg-red-50/60 p-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={leave}
          disabled={pending}
          className={`${ui.btnGhostDanger} min-h-[46px] px-3.5`}
        >
          Leave workspace
        </button>
        {isLeader ? (
          <button
            type="button"
            onClick={destroy}
            disabled={pending}
            className={`${ui.btnDanger} min-h-[46px] px-3.5`}
          >
            Delete workspace
          </button>
        ) : null}
      </div>
      {error ? <p className={`mt-3 ${ui.errorText}`}>{error}</p> : null}
    </section>
  );
}
