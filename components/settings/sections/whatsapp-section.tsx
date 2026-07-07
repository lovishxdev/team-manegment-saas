import { PhoneForm } from "@/components/settings/phone-form";
import { WhatsAppBotNumber } from "@/components/whatsapp/whatsapp-bot-number";
import { WhatsAppChatHistory } from "@/components/whatsapp/whatsapp-chat-history";
import type { AccountSettingsData } from "@/lib/settings/load-account-settings";

export function WhatsAppSection({ data }: { data: AccountSettingsData }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto pr-0.5">
      <div className="space-y-5">
        {data.whatsAppBotNumber &&
        data.whatsAppBotDisplay &&
        data.whatsAppDeepLink ? (
          <div>
            <WhatsAppBotNumber
              e164={data.whatsAppBotNumber}
              display={data.whatsAppBotDisplay}
              deepLink={data.whatsAppDeepLink}
            />
            <p className="mt-3 text-xs text-ink-faint">
              During Meta&apos;s test mode, only numbers added as recipients in
              your WhatsApp app dashboard can message this bot.
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong bg-paper-deep/40 px-4 py-3 text-sm text-ink-soft">
            The WhatsApp bot number is not configured yet. Set{" "}
            <code className="rounded bg-paper px-1 py-0.5 font-mono text-xs">
              NEXT_PUBLIC_WHATSAPP_BOT_NUMBER
            </code>{" "}
            in your environment (E.164 digits, no + or spaces).
          </p>
        )}

        <div>
          <h3 className="text-sm font-semibold text-ink">Your phone</h3>
          <p className="mb-3 mt-1 text-sm text-ink-soft">
            Country code + number, no + or spaces. Must match the WhatsApp
            account you message from. Leave empty if you don&apos;t use WhatsApp.
          </p>
          <PhoneForm currentPhone={data.user.phone} />
        </div>

        {data.showWhatsAppHistory ? (
          <div className="border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-ink">Recent chat</h3>
            <p className="mb-3 mt-1 text-xs text-ink-faint">
              Last messages with the Euclis bot (synced from WhatsApp).
            </p>
            <WhatsAppChatHistory
              messages={data.whatsAppHistory}
              className="min-h-48"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
