import { getMcpConnectorUrl } from "@/lib/app-origin";
import { userHasInitiatedWhatsAppChat } from "@/lib/services/conversation";
import { IntegrationsPrompt } from "@/components/integrations/integrations-prompt";
import { WhatsAppOnboardingSync } from "@/components/whatsapp/whatsapp-onboarding-sync";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
  whatsAppBotDeepLink,
} from "@/lib/whatsapp-bot";

/** Onboarding banner — deferred so it never blocks first paint. */
export async function AppShellIntegrations({
  userId,
  userPhone,
  whatsappChatCached,
}: {
  userId: string;
  userPhone: string | null;
  whatsappChatCached: boolean;
}) {
  const whatsappChatStarted =
    whatsappChatCached || (await userHasInitiatedWhatsAppChat(userId));
  if (whatsappChatStarted) return null;

  const whatsAppBotNumber = getWhatsAppBotNumber();
  const botDisplay = whatsAppBotNumber
    ? formatWhatsAppBotNumber(whatsAppBotNumber)
    : null;
  const botDeepLink = whatsAppBotNumber
    ? whatsAppBotDeepLink(whatsAppBotNumber)
    : null;
  const mcpConnectorUrl = await getMcpConnectorUrl();

  return (
    <>
      <WhatsAppOnboardingSync />
      <IntegrationsPrompt
        userId={userId}
        currentPhone={userPhone}
        botDisplay={botDisplay}
        botDeepLink={botDeepLink}
        mcpConnectorUrl={mcpConnectorUrl}
      />
    </>
  );
}
