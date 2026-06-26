"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createTaskAction, type ActionState } from "@/lib/actions/workspace";
import { Select } from "@/components/select";
import { ui } from "@/components/ui";

const SCOPES = ["GENERAL", "FRONTEND", "BACKEND", "DESIGN"] as const;
const initialState: ActionState = {};

const SCOPE_OPTIONS = SCOPES.map((s) => ({
  value: s,
  label: s.charAt(0) + s.slice(1).toLowerCase(),
}));

export function NewTaskForm({ workspaceId }: { workspaceId: string }) {
  const action = useMemo(
    () => createTaskAction.bind(null, workspaceId),
    [workspaceId]
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [scope, setScope] = useState<string>("GENERAL");

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      setScope("GENERAL");
    }
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className={ui.inputRow}>
      <div className={ui.inputRowField}>
        <input
          name="title"
          required
          disabled={pending}
          placeholder="Add a task..."
          className={ui.input}
        />
        {state.error && (
          <p className="mt-1 text-xs text-red-300">{state.error}</p>
        )}
      </div>
      <Select
        name="scope"
        value={scope}
        onChange={setScope}
        options={SCOPE_OPTIONS}
        className="w-[132px] shrink-0"
        aria-label="Task scope"
      />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`${ui.btnPrimary} ${ui.btnShrink} self-center`}
      >
        Add
      </button>
    </form>
  );
}
