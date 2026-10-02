export const GRAPH_API_VERSION = "v21.0";
const GRAPH_FETCH_TIMEOUT_MS = 15_000;
const GRAPH_FETCH_RETRIES = 2;

/** Temporary off-switch. Unset or any value other than 0/false/off keeps the bot on. */
export function isWhatsAppAgentEnabled(): boolean {
  const raw = process.env.WHATSAPP_AGENT_ENABLED?.trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

/** Shared Graph API fetch with timeout + one retry. */
export async function graphFetch(
  url: string,
  init: RequestInit
): Promise<Response | null> {
  if (!isWhatsAppAgentEnabled() && url.includes("/messages")) {
    console.error(
      "[whatsapp] send skipped — WHATSAPP_AGENT_ENABLED is off"
    );
    return null;
  }

  for (let attempt = 1; attempt <= GRAPH_FETCH_RETRIES; attempt++) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(GRAPH_FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      const retrying = attempt < GRAPH_FETCH_RETRIES;
      console.error(
        `WhatsApp Graph API fetch failed (attempt ${attempt}/${GRAPH_FETCH_RETRIES}):`,
        err
      );
      if (!retrying) return null;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return null;
}

export function graphMessagesUrl(): string | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) return null;
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}
