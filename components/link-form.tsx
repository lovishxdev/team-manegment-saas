"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { createLinkAction, type ActionState } from "@/lib/actions/workspace";
import { ui } from "@/components/ui";

const initialState: ActionState = {};

export function LinkForm({ workspaceId }: { workspaceId: string }) {
  const action = useMemo(
    () => createLinkAction.bind(null, workspaceId),
    [workspaceId]
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="link-title" className={ui.label}>
            Title
          </label>
          <input
            id="link-title"
            name="title"
            required
            maxLength={120}
            disabled={pending}
            placeholder="Design system"
            className={ui.input}
          />
        </div>
        <div>
          <label htmlFor="link-url" className={ui.label}>
            URL
          </label>
          <input
            id="link-url"
            name="url"
            type="url"
            required
            disabled={pending}
            placeholder="https://figma.com/..."
            className={ui.input}
          />
        </div>
      </div>
      <div>
        <label htmlFor="link-description" className={ui.label}>
          Note <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <input
          id="link-description"
          name="description"
          maxLength={500}
          disabled={pending}
          placeholder="Main file for the booth layout"
          className={ui.input}
        />
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className={`${ui.btnPrimary} w-full sm:w-auto`}
        >
          {pending ? "Saving..." : "Add link"}
        </button>
      </div>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
    </form>
  );
}
