"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePhoneAction, type SettingsState } from "@/lib/actions/settings";
import { CopyField } from "@/components/ui/copy-field";
import { PhoneNumberInput } from "@/components/settings/phone-number-input";
import { ui } from "@/components/ui/ui";
import { formatPhoneDisplay } from "@/lib/phone-countries";

const initialState: SettingsState = {};

type Tab = "whatsapp" | "claude";

function dismissKey(userId: string) {
  return `euclis:skip-integrations-prompt:${userId}`;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.75.75 0 0 0 .92.92l4.458-1.495A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.72 9.72 0 0 1-4.95-1.35l-.355-.21-3.047 1.02 1.02-3.047-.21-.355A9.72 9.72 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
    </svg>
  );
}

function ClaudeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" />
    </svg>
  );
}

function TabButton({
  active,
  brand,
  onClick,
  children,
}: {
  active: boolean;
  brand: Tab;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeStyles = {
    whatsapp: "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600",
    claude: "bg-claude text-white shadow-sm hover:bg-claude-dark",
  };
  const inactiveStyles = {
    whatsapp:
      "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15",
    claude: "border border-claude/30 bg-claude/10 text-claude hover:bg-claude/15",
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? activeStyles[brand] : inactiveStyles[brand]
      }`}
    >
      {children}
    </button>
  );
}

export function IntegrationsPrompt({
  userId,
  currentPhone,
  botDisplay,
  botDeepLink,
  mcpConnectorUrl,
}: {
  userId: string;
  currentPhone: string | null;
  botDisplay: string | null;
  botDeepLink: string | null;
  mcpConnectorUrl: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [state, formAction, pending] = useActionState(
    updatePhoneAction,
    initialState
  );

  useEffect(() => {
    const skipped =
      localStorage.getItem(dismissKey(userId)) === "1" ||
      localStorage.getItem(`euclis:skip-whatsapp-prompt:${userId}`) === "1";
    setOpen(!skipped);
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
      className="mb-6 rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-6"
      aria-labelledby="integrations-prompt-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            id="integrations-prompt-title"
            className="text-base font-semibold text-ink"
          >
            Work from WhatsApp or Claude
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Optional. The web dashboard works on its own. Connect a channel when
            you want tasks and updates where you already chat.
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

      <div
        role="tablist"
        aria-label="Integration options"
        className="mt-5 flex flex-wrap gap-2"
      >
        <TabButton
          active={tab === "whatsapp"}
          brand="whatsapp"
          onClick={() => setTab("whatsapp")}
        >
          <WhatsAppIcon />
          WhatsApp
        </TabButton>
        <TabButton
          active={tab === "claude"}
          brand="claude"
          onClick={() => setTab("claude")}
        >
          <ClaudeIcon className="h-3.5 w-3.5" />
          Claude
        </TabButton>
      </div>

      {tab === "whatsapp" ? (
        <div
          role="tabpanel"
          className="mt-5"
          aria-label="WhatsApp integration"
        >
          <p className="text-sm text-ink-soft">
            Link your number below, then send{" "}
            <span className="font-medium text-ink">hi</span> on WhatsApp to start
            the bot. Create tasks, check your board, and upload files from chat.
            {botDisplay ? (
              <>
                {" "}
                Bot number:{" "}
                <span className="font-mono text-xs text-ink">{botDisplay}</span>
              </>
            ) : null}
          </p>

          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-3 text-sm font-medium text-ink">
              {currentPhone ? "Your linked number" : "Step 1: Link your WhatsApp number"}
            </p>
            {currentPhone ? (
              <p className="mb-3 font-mono text-sm text-ink-soft">
                {formatPhoneDisplay(currentPhone) ?? currentPhone}
              </p>
            ) : null}
            <form action={formAction} className={ui.inputRow}>
              <PhoneNumberInput
                defaultPhone={currentPhone}
                disabled={pending}
                required={!currentPhone}
                nationalAriaLabel="WhatsApp mobile number"
              />
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className={`${ui.btnPrimary} ${ui.btnShrink} self-center`}
              >
                {currentPhone ? "Update" : "Save number"}
              </button>
            </form>
            <p className="mt-2 text-xs text-ink-faint">
              Pick your country code, then enter your mobile number without a
              leading zero. Must match the WhatsApp account you message from.
              Manage anytime in{" "}
              <Link href="/settings" className="text-accent hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>

          {botDeepLink ? (
            <div className="mt-6 border-t border-line pt-5">
              <p className="mb-3 text-sm font-medium text-ink">
                Step 2: Send hi to start
              </p>
              <p className="text-sm text-ink-soft">
                Open the bot in WhatsApp. We&apos;ll prefill{" "}
                <span className="font-medium text-ink">hi</span> for you. Tap send
                and the bot will reply with what it can do.
              </p>
              <a
                href={botDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white no-underline shadow-sm transition hover:bg-emerald-600"
              >
                <WhatsAppIcon />
                Send hi on WhatsApp
              </a>
            </div>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-line-strong bg-shell px-4 py-3 text-sm text-ink-soft">
              The bot number is not configured yet. Ask your admin to set{" "}
              <code className="font-mono text-xs">NEXT_PUBLIC_WHATSAPP_BOT_NUMBER</code>
              .
            </p>
          )}

          {state.error && <p className={`mt-2 ${ui.errorText}`}>{state.error}</p>}
          {state.message && (
            <p className="mt-2 text-sm text-accent">{state.message}</p>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="mt-5" aria-label="Claude integration">
          <p className="text-sm text-ink-soft">
            Add Euclis as a custom connector in Claude to manage workspaces and
            tasks from chat. Sign in with your Euclis account when prompted. No
            API key or bearer token needed.
          </p>

          <a
            href="https://claude.ai/customize/connectors"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-claude px-4 py-2.5 text-sm font-medium text-white no-underline shadow-sm transition hover:bg-claude-dark"
          >
            <ClaudeIcon className="h-4 w-4 shrink-0" />
            Open Claude Connectors
          </a>

          <p className="mb-2 mt-5 text-xs font-medium text-ink-soft">
            Connector URL
          </p>
          <CopyField value={mcpConnectorUrl} secret={false} />

          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs text-ink-faint">
            <li>
              Open{" "}
              <a
                href="https://claude.ai/customize/connectors"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Claude Connectors
              </a>{" "}
              and choose <span className="text-ink-soft">Add custom connector</span>.
            </li>
            <li>Copy the URL above and paste it as the server URL.</li>
            <li>Approve access when Claude redirects you to sign in.</li>
          </ol>

          <Link
            href="/settings"
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            More details in Settings →
          </Link>
        </div>
      )}
    </section>
  );
}
