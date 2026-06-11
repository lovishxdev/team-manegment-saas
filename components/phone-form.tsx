"use client";

import { useActionState } from "react";
import { updatePhoneAction, type SettingsState } from "@/lib/actions/settings";

const initialState: SettingsState = {};

export function PhoneForm({ currentPhone }: { currentPhone: string | null }) {
  const [state, formAction, pending] = useActionState(
    updatePhoneAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="phone"
        type="tel"
        defaultValue={currentPhone ?? ""}
        placeholder="919876543210"
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-500"
      />
      <p className="text-xs text-zinc-500">
        Country code + number, no + or spaces. This is the WhatsApp number the
        bot will recognize you by. Leave empty to disconnect.
      </p>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.message && (
        <p className="text-sm text-emerald-400">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
