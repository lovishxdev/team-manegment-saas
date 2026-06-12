"use client";

import { useActionState } from "react";
import {
  updateUsernameAction,
  type SettingsState,
} from "@/lib/actions/settings";
import { ui } from "@/components/ui";

const initialState: SettingsState = {};

export function UsernameForm({
  currentUsername,
}: {
  currentUsername: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateUsernameAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="username"
        type="text"
        defaultValue={currentUsername ?? ""}
        placeholder="your_handle"
        maxLength={24}
        autoComplete="off"
        className={`${ui.input} font-mono lowercase`}
      />
      <p className="text-xs text-ink-faint">
        3-24 characters: lowercase letters, digits, underscores. Shown to your
        teammates instead of your email. Leave empty to remove.
      </p>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
      {state.message && <p className="text-sm text-accent">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`self-start ${ui.btnPrimary}`}
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
