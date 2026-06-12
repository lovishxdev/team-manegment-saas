"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTaskAction, type ActionState } from "@/lib/actions/workspace";
import { ui } from "@/components/ui";

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
          className={ui.input}
        />
        {state.error && (
          <p className="mt-1 text-xs text-red-300">{state.error}</p>
        )}
      </div>
      <select name="scope" className={ui.select}>
        {SCOPES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={ui.btnPrimary}>
        {pending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
