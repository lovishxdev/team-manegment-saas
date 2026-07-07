"use client";

import { useActionState } from "react";
import { deleteAccountAction, type SettingsState } from "@/lib/actions/settings";
import { ui } from "@/components/ui/ui";

const initialState: SettingsState = {};

export function DeleteAccount({
  confirmLabel,
}: {
  confirmLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initialState
  );

  return (
    <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-5">
      <h2 className="text-sm font-semibold text-red-700">Delete account</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Permanently removes your account, OAuth tokens, and WhatsApp link.
        Workspaces where you&apos;re the only member are deleted. Tasks you
        created stay; assets you uploaded are removed.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label className="text-xs text-ink-faint">
          Type{" "}
          <span className="font-mono text-ink">{confirmLabel}</span> to confirm
        </label>
        <input
          name="confirm"
          type="text"
          autoComplete="off"
          placeholder={confirmLabel}
          className={ui.input}
        />
        {state.error && <p className={ui.errorText}>{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`self-start ${ui.btnDanger}`}
        >
          Delete my account
        </button>
      </form>
    </section>
  );
}
