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

export type InteractiveChrome = {
  /** Short bold line above the body (max 60 chars). */
  header?: string;
  /** Muted line below the buttons (max 60 chars). */
  footer?: string;
};

function buildChrome(chrome?: InteractiveChrome): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (chrome?.header?.trim()) {
    out.header = { type: "text", text: chrome.header.trim().slice(0, 60) };
  }
  if (chrome?.footer?.trim()) {
    out.footer = { text: chrome.footer.trim().slice(0, 60) };
  }
  return out;
}

async function sendInteractive(
  to: string,
  body: string,
  interactive: Record<string, unknown>,
  chrome?: InteractiveChrome
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
        ...buildChrome(chrome),
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
  buttons: WhatsAppButton[],
  chrome?: InteractiveChrome
): Promise<boolean> {
  if (buttons.length === 0 || buttons.length > 3) {
    console.error("[whatsapp] buttons require 1–3 items");
    return false;
  }

  return sendInteractive(
    to,
    body,
    {
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
    },
    chrome
  );
}

/** List message — one menu button, cleaner than 3 stacked reply buttons. */
export const WHATSAPP_LIST_MAX_ROWS = 10;

export async function sendWhatsAppList(
  to: string,
  body: string,
  buttonLabel: string,
  sections: WhatsAppListSection[],
  chrome?: InteractiveChrome
): Promise<boolean> {
  const rowCount = sections.reduce((n, s) => n + s.rows.length, 0);
  if (rowCount === 0 || rowCount > WHATSAPP_LIST_MAX_ROWS) {
    console.error(
      `[whatsapp] list requires 1–${WHATSAPP_LIST_MAX_ROWS} rows, got ${rowCount}`
    );
    return false;
  }

  return sendInteractive(
    to,
    body,
    {
      type: "list",
      action: {
        button: buttonLabel.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description
              ? { description: r.description.slice(0, 72) }
              : {}),
          })),
        })),
      },
    },
    chrome
  );
}

/** CTA URL button (single external link). */
export async function sendWhatsAppCtaUrl(
  to: string,
  body: string,
  displayText: string,
  url: string,
  chrome?: InteractiveChrome
): Promise<boolean> {
  return sendInteractive(
    to,
    body,
    {
      type: "cta_url",
      action: {
        name: "cta_url",
        parameters: {
          display_text: displayText.slice(0, 20),
          url,
        },
      },
    },
    chrome
  );
}
