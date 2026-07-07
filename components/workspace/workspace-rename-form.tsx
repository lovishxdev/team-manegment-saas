"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef } from "react";
import {
  renameWorkspaceAction,
  type ActionState,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

const initialState: ActionState = {};

export function WorkspaceRenameForm({
  workspaceId,
  initialName,
}: {
  workspaceId: string;
  initialName: string;
}) {
  const router = useRouter();
  const wasPending = useRef(false);
  const action = useMemo(
    () => renameWorkspaceAction.bind(null, workspaceId),
    [workspaceId]
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router, state.error]);

  return (
    <form action={formAction} className="max-w-xl">
      <label htmlFor="workspace-name" className={ui.label}>
        Workspace name
      </label>
      <div className={ui.inputRow}>
        <div className={ui.inputRowField}>
          <input
            id="workspace-name"
            key={initialName}
            name="name"
            required
            defaultValue={initialName}
            disabled={pending}
            className={ui.input}
          />
          {state.error && (
            <p className="mt-1.5 text-xs text-red-600">{state.error}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${ui.btnSecondary} ${ui.btnShrink} min-h-[46px] self-center px-4`}
        >
          Save name
        </button>
      </div>
    </form>
  );
}
