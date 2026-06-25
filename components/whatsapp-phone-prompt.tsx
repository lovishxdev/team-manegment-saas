"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePhoneAction, type SettingsState } from "@/lib/actions/settings";
import { ui } from "@/components/ui";

const initialState: SettingsState = {};

function dismissKey(userId: string) {
  return `euclis:skip-whatsapp-prompt:${userId}`;
}

export function WhatsAppPhonePrompt({
  userId,
  botDisplay,
  botDeepLink,
}: {
  userId: string;
  botDisplay: string | null;
  botDeepLink: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updatePhoneAction,
    initialState
  );

  useEffect(() => {
    setOpen(localStorage.getItem(dismissKey(userId)) !== "1");
  }, [userId]);

  useEffect(() => {
    if (state.message) {
      router.refresh();
    }
  }, [state.message, router]);

  if (!open) return null;

  function skip() {
    localStorage.setItem(dismissKey(userId), "1");
    setOpen(false);
  }

  return (
    <section
      className="mb-6 rounded-2xl border border-accent/25 bg-accent-soft/40 p-5 shadow-sm"
      aria-labelledby="whatsapp-prompt-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            id="whatsapp-prompt-title"
            className="text-sm font-semibold text-ink"
          >
            Link WhatsApp (optional)
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Skip this if you only use the web dashboard. Add your number here if
            you want to manage tasks from WhatsApp
            {botDisplay ? (
              <>
                {" "}
                by messaging{" "}
                <span className="font-mono text-xs text-ink">{botDisplay}</span>
              </>
            ) : (
              "."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={skip}
          className="shrink-0 self-start text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          Not now
        </button>
      </div>

      <form action={formAction} className={`mt-4 ${ui.inputRow}`}>
        <div className={ui.inputRowField}>
          <input
            name="phone"
            type="tel"
            required
            disabled={pending}
            placeholder="91xxxxxxxxxx"
            className={ui.input}
            aria-label="WhatsApp phone number"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`${ui.btnPrimary} ${ui.btnShrink}`}
        >
          {pending ? "Saving..." : "Save number"}
        </button>
      </form>

      <p className="mt-2 text-xs text-ink-faint">
        Country code + number, no + or spaces. You can change this anytime in{" "}
        <Link href="/settings" className="text-accent hover:underline">
          Settings
        </Link>
        {botDeepLink ? (
          <>
            {" "}
            or{" "}
            <a
              href={botDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              open the bot in WhatsApp
            </a>
          </>
        ) : null}
        .
      </p>

      {state.error && <p className={`mt-2 ${ui.errorText}`}>{state.error}</p>}
      {state.message && (
        <p className="mt-2 text-sm text-accent">{state.message}</p>
      )}
    </section>
  );
}
