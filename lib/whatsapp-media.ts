import { graphFetch, GRAPH_API_VERSION } from "@/lib/whatsapp-graph";

/** Upload PNG buffer to WhatsApp media API; returns media id for sending. */
export async function uploadWhatsAppMedia(
  buffer: Buffer,
  mimeType = "image/png"
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    console.error("[whatsapp] media upload skipped — missing env");
    return null;
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    "whiteboard.png"
  );
  form.append("type", mimeType);

  const res = await graphFetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res?.ok) {
    const detail = await res?.text().catch(() => "");
    console.error(
      `[whatsapp] media upload failed status=${res?.status ?? "n/a"}: ${detail}`
    );
    return null;
  }

  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

/** Send an image by media id (upload first via uploadWhatsAppMedia). */
export async function sendWhatsAppImage(
  to: string,
  mediaId: string,
  caption?: string
): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return false;

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
        type: "image",
        image: {
          id: mediaId,
          ...(caption ? { caption: caption.slice(0, 1024) } : {}),
        },
      }),
    }
  );

  if (!res?.ok) {
    const detail = await res?.text().catch(() => "");
    console.error(
      `[whatsapp] image send failed to=${to} status=${res?.status ?? "n/a"}: ${detail}`
    );
    return false;
  }

  return true;
}

/** Upload buffer and send image in one step. */
export async function sendWhatsAppImageBuffer(
  to: string,
  buffer: Buffer,
  caption?: string
): Promise<boolean> {
  const mediaId = await uploadWhatsAppMedia(buffer);
  if (!mediaId) return false;
  return sendWhatsAppImage(to, mediaId, caption);
}
