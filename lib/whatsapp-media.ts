import { graphFetch, GRAPH_API_VERSION } from "@/lib/whatsapp-graph";

/** Upload media buffer to WhatsApp; returns media id for sending. */
export async function uploadWhatsAppMedia(
  buffer: Buffer,
  mimeType = "image/png",
  fileName = "file"
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
    fileName
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

/** Send a document by media id (PDF, etc.). */
export async function sendWhatsAppDocument(
  to: string,
  mediaId: string,
  fileName: string,
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
        type: "document",
        document: {
          id: mediaId,
          filename: fileName.slice(0, 240),
          ...(caption ? { caption: caption.slice(0, 1024) } : {}),
        },
      }),
    }
  );

  if (!res?.ok) {
    const detail = await res?.text().catch(() => "");
    console.error(
      `[whatsapp] document send failed to=${to} status=${res?.status ?? "n/a"}: ${detail}`
    );
    return false;
  }

  return true;
}

const WHATSAPP_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

/** Upload buffer and send as image or document depending on mime type. */
export async function sendWhatsAppMediaBuffer(
  to: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  caption?: string
): Promise<boolean> {
  if (buffer.length > WHATSAPP_MEDIA_MAX_BYTES) {
    console.error(
      `[whatsapp] media too large (${buffer.length} bytes) file=${fileName}`
    );
    return false;
  }
  const mediaId = await uploadWhatsAppMedia(buffer, mimeType, fileName);
  if (!mediaId) return false;
  if (isImageMime(mimeType)) {
    return sendWhatsAppImage(to, mediaId, caption ?? fileName);
  }
  return sendWhatsAppDocument(to, mediaId, fileName, caption);
}

/** Upload buffer and send image in one step. */
export async function sendWhatsAppImageBuffer(
  to: string,
  buffer: Buffer,
  caption?: string
): Promise<boolean> {
  return sendWhatsAppMediaBuffer(to, buffer, "image/png", "whiteboard.png", caption);
}
