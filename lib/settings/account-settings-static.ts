import { getAppBaseUrl } from "@/lib/app-url";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
  whatsAppBotDeepLink,
} from "@/lib/whatsapp-bot";

/** Bot number + MCP URL — env/origin only, no DB. */
export function staticAccountSettingsFields(origin?: string) {
  const whatsAppBotNumber = getWhatsAppBotNumber();
  const mcpConnectorUrl = origin
    ? `${origin.replace(/\/$/, "")}/api/mcp`
    : `${getAppBaseUrl()}/api/mcp`;

  return {
    whatsAppBotNumber,
    whatsAppBotDisplay: whatsAppBotNumber
      ? formatWhatsAppBotNumber(whatsAppBotNumber)
      : null,
    whatsAppDeepLink: whatsAppBotNumber
      ? whatsAppBotDeepLink(whatsAppBotNumber)
      : null,
    mcpConnectorUrl,
  };
}
