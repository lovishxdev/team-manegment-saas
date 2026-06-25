"use client";

import { useActionState } from "react";
import { updatePhoneAction, type SettingsState } from "@/lib/actions/settings";
import { ui } from "@/components/ui";

const initialState: SettingsState = {};

export function PhoneForm({ currentPhone }: { currentPhone: string | null }) {
  const [state, formAction, pending] = useActionState(
    updatePhoneAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className={ui.inputRow}>
        <div className={ui.inputRowField}>
          <input
            name="phone"
            type="tel"
            disabled={pending}
            defaultValue={currentPhone ?? ""}
            placeholder="91xxxxxxxxxx"
            className={ui.input}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`${ui.btnPrimary} ${ui.btnShrink}`}
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        Country code + number, no + or spaces. This is the WhatsApp number the
        bot will recognize you by. Leave empty to disconnect.
      </p>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
      {state.message && (
        <p className="text-sm text-accent">{state.message}</p>
      )}
    </form>
  );
}
