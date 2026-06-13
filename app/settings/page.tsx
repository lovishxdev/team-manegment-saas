import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ui } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { DeleteAccount } from "@/components/delete-account";
import { PhoneForm } from "@/components/phone-form";
import { RegenerateToken } from "@/components/regenerate-token";
import { UsernameForm } from "@/components/username-form";
import { WhatsAppBotNumber } from "@/components/whatsapp-bot-number";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
  whatsAppBotDeepLink,
} from "@/lib/whatsapp-bot";

export default async function SettingsPage() {
  const user = await requireUser();
  const whatsAppBotNumber = getWhatsAppBotNumber();

  return (
    <AppShell userId={user.id} userLabel={user.username ?? user.email}>
      <main className="mx-auto w-full max-w-2xl">
        <div className={`${ui.pageTitleRow} mb-8`}>
          <h1 className={ui.pageTitle}>Settings</h1>
        </div>

        <section className="mb-6 rounded-2xl bg-paper p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">Profile</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Signed in as{" "}
            <span className="font-mono text-xs text-ink">{user.email}</span>.
            Pick a username your teammates will see on boards and member lists.
          </p>
          <UsernameForm currentUsername={user.username} />
        </section>

        <section className="mb-6 rounded-2xl bg-paper p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">WhatsApp</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Link a phone here only if you want to use the WhatsApp bot. Not part
            of signup — skip this section if you use the web dashboard only.
          </p>

          {whatsAppBotNumber ? (
            <div className="mb-6">
              <WhatsAppBotNumber
                e164={whatsAppBotNumber}
                display={formatWhatsAppBotNumber(whatsAppBotNumber)}
                deepLink={whatsAppBotDeepLink(whatsAppBotNumber)}
              />
              <p className="mt-3 text-xs text-ink-faint">
                During Meta&apos;s test mode, only numbers added as recipients
                in your WhatsApp app dashboard can message this bot.
              </p>
            </div>
          ) : (
            <p className="mb-6 rounded-lg border border-dashed border-line-strong bg-paper-deep/40 px-4 py-3 text-sm text-ink-soft">
              The WhatsApp bot number is not configured yet. Set{" "}
              <code className="rounded bg-paper px-1 py-0.5 font-mono text-xs">
                NEXT_PUBLIC_WHATSAPP_BOT_NUMBER
              </code>{" "}
              in your environment (E.164 digits, no + or spaces).
            </p>
          )}

          <h3 className="text-sm font-semibold text-ink">Your phone</h3>
          <p className="mb-3 mt-1 text-sm text-ink-soft">
            Country code + number, no + or spaces. Must match the WhatsApp
            account you message from. Leave empty if you don&apos;t use WhatsApp.
          </p>
          <PhoneForm currentPhone={user.phone} />
        </section>

        <section className="mb-6 rounded-2xl bg-paper p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">
            Claude App connector
          </h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Add this app as a custom connector in Claude (Settings &gt;
            Connectors) using the MCP endpoint{" "}
            <code className="rounded-md bg-paper-deep px-1.5 py-0.5 text-xs">
              /api/mcp
            </code>{" "}
            and the token below as your Bearer token. Treat it like a password.
          </p>
          <CopyField value={user.mcpToken} />
          <RegenerateToken />
        </section>

        <DeleteAccount confirmLabel={user.email ?? "DELETE"} />
      </main>
    </AppShell>
  );
}
