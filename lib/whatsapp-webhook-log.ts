/** Verbose WhatsApp webhook logs for local/ngrok debugging. */
export function isWhatsAppWebhookDebug(): boolean {
  if (process.env.WHATSAPP_WEBHOOK_DEBUG === "1") return true;
  if (process.env.WHATSAPP_WEBHOOK_DEBUG === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export function waWebhookLog(
  event: string,
  details?: Record<string, unknown>
): void {
  if (!isWhatsAppWebhookDebug()) return;
  const ts = new Date().toISOString();
  if (details && Object.keys(details).length > 0) {
    console.log(`[whatsapp-webhook] ${ts} ${event}`, details);
  } else {
    console.log(`[whatsapp-webhook] ${ts} ${event}`);
  }
}

/** Safe summary of a Meta webhook payload (no message bodies in logs). */
export function summarizeMetaPayload(payload: unknown): Record<string, unknown> {
  try {
    const entry = (payload as { entry?: unknown[] })?.entry?.[0] as
      | Record<string, unknown>
      | undefined;
    const change = (entry?.changes as unknown[] | undefined)?.[0] as
      | Record<string, unknown>
      | undefined;
    const value = change?.value as Record<string, unknown> | undefined;
    const message = (value?.messages as unknown[] | undefined)?.[0] as
      | Record<string, unknown>
      | undefined;
    const metadata = value?.metadata as Record<string, unknown> | undefined;

    return {
      object: (payload as { object?: string })?.object ?? null,
      field: change?.field ?? null,
      phoneNumberId: metadata?.phone_number_id ?? null,
      displayPhone: metadata?.display_phone_number ?? null,
      messageCount: (value?.messages as unknown[] | undefined)?.length ?? 0,
      statusCount: (value?.statuses as unknown[] | undefined)?.length ?? 0,
      from: message?.from ?? null,
      messageType: message?.type ?? null,
      messageId: message?.id ?? null,
      textPreview:
        message?.type === "text"
          ? truncate(String((message.text as { body?: string })?.body ?? ""), 80)
          : null,
    };
  } catch {
    return { parseError: true };
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function describeSignatureFailure(
  signatureHeader: string | null
): string {
  if (!process.env.WHATSAPP_APP_SECRET) {
    return "WHATSAPP_APP_SECRET is not set in environment";
  }
  if (!signatureHeader) {
    return "missing X-Hub-Signature-256 header (Meta test tool may omit it)";
  }
  if (!signatureHeader.startsWith("sha256=")) {
    return "X-Hub-Signature-256 has unexpected format";
  }
  return "HMAC mismatch — WHATSAPP_APP_SECRET likely wrong for this app";
}
