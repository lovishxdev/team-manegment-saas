import crypto from "crypto";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_FETCH_TIMEOUT_MS = 15_000;
const GRAPH_FETCH_RETRIES = 2;

async function graphFetch(
  url: string,
  init: RequestInit
): Promise<Response | null> {
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

/** Sends a plain text WhatsApp message via Meta's Graph API. Returns false on failure. */
export async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    console.error(
      "[whatsapp-webhook] send skipped — missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN"
    );
    return false;
  }

  const res = await graphFetch(
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

  if (!res) return false;

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(
      `[whatsapp-webhook] send failed to=${to} phoneNumberId=${phoneNumberId} status=${res.status}: ${detail}`
    );
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[whatsapp-webhook] send OK to=${to}`);
  }

  return true;
}

/** Blue-tick read receipt on the user's inbound message. */
export async function markWhatsAppRead(messageId: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return;

  const res = await graphFetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    }
  );

  if (!res?.ok) {
    const detail = res ? await res.text().catch(() => "") : "network error";
    console.error(`WhatsApp mark-read failed (${res?.status ?? "n/a"}): ${detail}`);
  }
}

export type InboundMessage =
  | { kind: "text"; from: string; text: string; messageId: string }
  | {
      kind: "media";
      from: string;
      mediaId: string;
      mimeType: string;
      fileName: string;
      caption: string | null;
      messageId: string;
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
    const messageId = message.id as string;
    if (!messageId) return null;

    if (message.type === "text") {
      return { kind: "text", from, text: message.text.body as string, messageId };
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
        messageId,
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

  const metaRes = await graphFetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    { headers: auth }
  );
  if (!metaRes?.ok) {
    throw new Error(`Media metadata fetch failed (${metaRes?.status ?? "network"})`);
  }
  const { url } = (await metaRes.json()) as { url: string };

  const fileRes = await graphFetch(url, { headers: auth });
  if (!fileRes?.ok) {
    throw new Error(`Media download failed (${fileRes?.status ?? "network"})`);
  }
  return Buffer.from(await fileRes.arrayBuffer());
}
