"use client";

import { useActionState } from "react";
import {
  updateMcpWorkspaceAction,
  type SettingsState,
} from "@/lib/actions/settings";
import { ui } from "@/components/ui/ui";

const initialState: SettingsState = {};

export type WorkspaceOption = { id: string; name: string };

export function McpWorkspaceForm({
  workspaces,
  currentWorkspaceId,
}: {
  workspaces: WorkspaceOption[];
  currentWorkspaceId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateMcpWorkspaceAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className={ui.inputRow}>
        <div className={ui.inputRowField}>
          <select
            name="workspaceId"
            defaultValue={currentWorkspaceId ?? ""}
            disabled={pending}
            className={`w-full ${ui.select}`}
          >
            <option value="">Not pinned — all workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                Pin to: {ws.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${ui.btnPrimary} ${ui.btnShrink} self-center`}
        >
          Save
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        Applies only to the personal bearer token (manual setup). Connections
        made via &quot;Add to Cursor&quot; or the Claude connector pick their
        workspace on the consent screen when you approve them.
      </p>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
      {state.message && <p className={ui.successText}>{state.message}</p>}
    </form>
  );
}
