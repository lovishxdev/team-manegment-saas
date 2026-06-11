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

export type InboundMessage =
  | { kind: "text"; from: string; text: string }
  | {
      kind: "media";
      from: string;
      mediaId: string;
      mimeType: string;
      fileName: string;
      caption: string | null;
    };

/** Extracts the first inbound message (text, image, or document). */
export function extractInboundMessage(payload: unknown): InboundMessage | null {
  try {
    const entry = (payload as any)?.entry?.[0];
    const change = entry?.changes?.[0];
    if (change?.field !== "messages") return null;

    const message = change?.value?.messages?.[0];
    if (!message) return null;
    const from = message.from as string;

    if (message.type === "text") {
      return { kind: "text", from, text: message.text.body as string };
    }

    if (message.type === "image" || message.type === "document") {
      const media = message[message.type];
      const mimeType = (media.mime_type as string) ?? "application/octet-stream";
      const extension = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
      return {
        kind: "media",
        from,
        mediaId: media.id as string,
        mimeType,
        fileName:
          (media.filename as string | undefined) ??
          `whatsapp-${message.type}-${Date.now()}.${extension}`,
        caption: (media.caption as string | undefined) ?? null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/** Downloads a media file from Meta (two-step: metadata, then binary). */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<Buffer> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Missing WHATSAPP_ACCESS_TOKEN environment variable");
  }
  const auth = { Authorization: `Bearer ${accessToken}` };

  const metaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    { headers: auth }
  );
  if (!metaRes.ok) {
    throw new Error(`Media metadata fetch failed (${metaRes.status})`);
  }
  const { url } = (await metaRes.json()) as { url: string };

  const fileRes = await fetch(url, { headers: auth });
  if (!fileRes.ok) {
    throw new Error(`Media download failed (${fileRes.status})`);
  }
  return Buffer.from(await fileRes.arrayBuffer());
}
