"use client";

import { useState } from "react";
import { ui } from "@/components/ui";

export function WhatsAppBotNumber({
  e164,
  display,
  deepLink,
}: {
  e164: string;
  display: string;
  deepLink: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const btn =
    "rounded-md border border-line-strong px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-ink/50 hover:text-ink";

  return (
    <div className="rounded-lg border border-line bg-paper-deep/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        Text this number
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink">
          {display}
        </code>
        <button type="button" onClick={copy} className={btn}>
          {copied ? "Copied!" : "Copy"}
        </button>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`${ui.btnSecondary} py-1.5`}
        >
          Open in WhatsApp
        </a>
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-faint">
        E.164: {e164}
      </p>
    </div>
  );
}
