"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTaskAction, type ActionState } from "@/lib/actions/workspace";

const SCOPES = ["GENERAL", "FRONTEND", "BACKEND", "DESIGN"] as const;
const initialState: ActionState = {};

export function NewTaskForm({ workspaceId }: { workspaceId: string }) {
  const action = createTaskAction.bind(null, workspaceId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          name="title"
          required
          placeholder="Add a task..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-500"
        />
        {state.error && (
          <p className="mt-1 text-xs text-red-400">{state.error}</p>
        )}
      </div>
      <select
        name="scope"
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-indigo-500"
      >
        {SCOPES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
