import { requireUser } from "@/lib/auth";
import { getMcpConnectorUrl } from "@/lib/app-origin";
import { ui } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { DeleteAccount } from "@/components/delete-account";
import { PhoneForm } from "@/components/phone-form";
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
  const mcpConnectorUrl = await getMcpConnectorUrl();

  return (
      <main className="mx-auto w-full max-w-2xl">
        <div className={`${ui.pageTitleRow} mb-8`}>
          <h1 className={ui.pageTitle}>Settings</h1>
        </div>

        <section className="mb-6 rounded-2xl bg-paper p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">Profile</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">
            Signed in as{" "}
            <span className="font-mono text-xs text-ink">@{user.username}</span>
            {user.email ? (
              <>
                {" "}
                (<span className="font-mono text-xs text-ink-faint">
                  {user.email}
                </span>
                )
              </>
            ) : null}
            . Your username is shown to teammates on boards and member lists.
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
            In Claude, open <span className="text-ink">Settings → Connectors</span>
            , choose <span className="text-ink">Add custom connector</span>, and
            paste the URL below. Claude will sign you in with your Euclis account
            — no bearer token or API key needed.
          </p>
          <p className="mb-2 text-xs font-medium text-ink-soft">
            Connector URL
          </p>
          <CopyField value={mcpConnectorUrl} secret={false} />
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs text-ink-faint">
            <li>Copy the URL above.</li>
            <li>In Claude, add a custom MCP connector and paste it as the server URL.</li>
            <li>Approve access when Claude redirects you to Euclis to sign in.</li>
          </ol>
        </section>

        <DeleteAccount confirmLabel={user.email ?? "DELETE"} />
      </main>
  );
}
