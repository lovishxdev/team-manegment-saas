import { graphFetch, graphMessagesUrl } from "@/lib/whatsapp-graph";

export type WhatsAppButton = {
  id: string;
  title: string;
};

export type WhatsAppListRow = {
  id: string;
  title: string;
  description?: string;
};

export type WhatsAppListSection = {
  title: string;
  rows: WhatsAppListRow[];
};

async function sendInteractive(
  to: string,
  body: string,
  interactive: Record<string, unknown>
): Promise<boolean> {
  const url = graphMessagesUrl();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!url || !accessToken) {
    console.error(
      "[whatsapp] interactive send skipped — missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN"
    );
    return false;
  }

  const res = await graphFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        body: { text: body.slice(0, 1024) },
        ...interactive,
      },
    }),
  });

  if (!res?.ok) {
    const detail = res ? await res.text().catch(() => "") : "network error";
    console.error(
      `[whatsapp] interactive send failed to=${to} status=${res?.status ?? "n/a"}: ${detail}`
    );
    return false;
  }

  return true;
}

/** Up to 3 reply buttons (title max 20 chars). */
export async function sendWhatsAppButtons(
  to: string,
  body: string,
  buttons: WhatsAppButton[]
): Promise<boolean> {
  if (buttons.length === 0 || buttons.length > 3) {
    console.error("[whatsapp] buttons require 1–3 items");
    return false;
  }

  return sendInteractive(to, body, {
    type: "button",
    action: {
      buttons: buttons.map((b) => ({
        type: "reply",
        reply: {
          id: b.id.slice(0, 256),
          title: b.title.slice(0, 20),
        },
      })),
    },
  });
}

/** List message — up to 10 rows total across sections. */
export async function sendWhatsAppList(
  to: string,
  body: string,
  buttonLabel: string,
  sections: WhatsAppListSection[]
): Promise<boolean> {
  const rowCount = sections.reduce((n, s) => n + s.rows.length, 0);
  if (rowCount === 0 || rowCount > 10) {
    console.error("[whatsapp] list requires 1–10 rows");
    return false;
  }

  return sendInteractive(to, body, {
    type: "list",
    action: {
      button: buttonLabel.slice(0, 20),
      sections: sections.map((s) => ({
        title: s.title.slice(0, 24),
        rows: s.rows.map((r) => ({
          id: r.id.slice(0, 200),
          title: r.title.slice(0, 24),
          ...(r.description ? { description: r.description.slice(0, 72) } : {}),
        })),
      })),
    },
  });
}

/** CTA URL button (single external link). */
export async function sendWhatsAppCtaUrl(
  to: string,
  body: string,
  displayText: string,
  url: string
): Promise<boolean> {
  return sendInteractive(to, body, {
    type: "cta_url",
    action: {
      name: "cta_url",
      parameters: {
        display_text: displayText.slice(0, 20),
        url,
      },
    },
  });
}
