"use client";

import { useActionState } from "react";
import { updatePhoneAction, type SettingsState } from "@/lib/actions/settings";
import { PhoneNumberInput } from "@/components/settings/phone-number-input";
import { ui } from "@/components/ui/ui";

const initialState: SettingsState = {};

export function PhoneForm({ currentPhone }: { currentPhone: string | null }) {
  const [state, formAction, pending] = useActionState(
    updatePhoneAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className={ui.inputRow}>
        <PhoneNumberInput
          defaultPhone={currentPhone}
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`${ui.btnPrimary} ${ui.btnShrink} self-center`}
        >
          Save
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        Pick your country code, then enter your mobile number without a leading
        zero. This is the WhatsApp number the bot will recognize you by. Clear
        the number and save to disconnect.
      </p>
      {state.error && <p className={ui.errorText}>{state.error}</p>}
      {state.message && (
        <p className="text-sm text-accent">{state.message}</p>
      )}
    </form>
  );
}
