"use client";

import { useActionState } from "react";
import {
  createWorkspaceAction,
  type ActionState,
} from "@/lib/actions/workspace";

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
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-500"
        />
        {state.error && (
          <p className="mt-1 text-xs text-red-400">{state.error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
