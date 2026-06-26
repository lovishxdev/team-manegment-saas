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
    <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-5">
      <h2 className="text-sm font-semibold text-red-300">
        Danger zone
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={leave} disabled={pending} className={ui.btnGhostDanger}>
          Leave workspace
        </button>
        {isLeader && (
          <button onClick={destroy} disabled={pending} className={ui.btnDanger}>
            Delete workspace
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </section>
  );
}
