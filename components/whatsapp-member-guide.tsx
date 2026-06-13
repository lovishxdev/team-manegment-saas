import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
} from "@/lib/whatsapp-bot";

/** Admin-only checklist on the Members page — not shown to new signups. */
export function WhatsAppMemberGuide() {
  const botNumber = getWhatsAppBotNumber();
  const botDisplay = botNumber ? formatWhatsAppBotNumber(botNumber) : null;

  return (
    <div className="rounded-xl border border-line bg-paper-deep/40 px-4 py-4 text-sm text-ink-soft">
      <p className="font-medium text-ink">WhatsApp testing checklist</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>
          Invite testers from this page. Signup is email only — no phone step.
        </li>
        <li>
          In the Meta app dashboard, add each tester&apos;s WhatsApp number under{" "}
          <strong>WhatsApp → API Setup → To</strong> (required in test mode).
        </li>
        <li>
          Share the bot number
          {botDisplay ? (
            <>
              {" "}
              (<span className="font-mono text-xs text-ink">{botDisplay}</span>)
            </>
          ) : (
            " (set NEXT_PUBLIC_WHATSAPP_BOT_NUMBER first)"
          )}
          . Anyone who wants the bot links their own number in Settings — you
          don&apos;t enter it for them.
        </li>
      </ol>
    </div>
  );
}
