"use client";

import { useActionState } from "react";
import {
  createWorkspaceAction,
  type ActionState,
} from "@/lib/actions/workspace";
import { ui } from "@/components/ui";

const initialState: ActionState = {};

export function CreateWorkspaceForm() {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    initialState
  );

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          name="name"
          required
          placeholder="New workspace name"
          className={ui.input}
        />
        {state.error && (
          <p className="mt-1 text-xs text-red-300">{state.error}</p>
        )}
      </div>
      <button type="submit" disabled={pending} className={ui.btnPrimary}>
        {pending ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
