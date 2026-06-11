import crypto from "crypto";

const GRAPH_API_VERSION = "v21.0";

/**
 * Verifies Meta's X-Hub-Signature-256 webhook signature against the raw
 * request body. Rejecting forged payloads matters here because the webhook
 * authenticates users by phone number alone.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(received, "hex"),
    Buffer.from(expected, "hex")
  );
}

/** Sends a plain text WhatsApp message via Meta's Graph API. */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN environment variables"
    );
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`WhatsApp send failed (${res.status}): ${detail}`);
  }
}

/** Extracts the first inbound text message from a Meta webhook payload. */
export function extractInboundMessage(
  payload: unknown
): { from: string; text: string } | null {
  try {
    const entry = (payload as any)?.entry?.[0];
    const change = entry?.changes?.[0];
    if (change?.field !== "messages") return null;

    const message = change?.value?.messages?.[0];
    if (!message || message.type !== "text") return null;

    return { from: message.from as string, text: message.text.body as string };
  } catch {
    return null;
  }
}
