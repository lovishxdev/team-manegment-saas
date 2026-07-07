"use client";

import { useActionState } from "react";
import {
  updateUsernameAction,
  type SettingsState,
} from "@/lib/actions/settings";
import { ui } from "@/components/ui/ui";

const initialState: SettingsState = {};

export function UsernameForm({
  currentUsername,
}: {
  currentUsername: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateUsernameAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className={ui.inputRow}>
        <div className={ui.inputRowField}>
          <input
            name="username"
            type="text"
            required
            disabled={pending}
            defaultValue={currentUsername}
            placeholder="your_handle"
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]{3,24}"
            autoComplete="username"
            className={`${ui.input} font-mono lowercase`}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${ui.btnPrimary} ${ui.btnShrink} self-center`}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        3-24 characters: lowercase letters, digits, underscores. Shown to your
        teammates on boards and member lists.
      </p>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
      {state.message && <p className={ui.successText}>{state.message}</p>}
    </form>
  );
}
