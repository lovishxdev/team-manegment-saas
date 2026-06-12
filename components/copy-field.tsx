"use client";

import { useState } from "react";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const btn =
    "rounded-md border border-line-strong px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-ink/50 hover:text-ink";

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-line bg-paper-deep px-3 py-2 font-mono text-xs text-ink-soft">
        {revealed ? value : "••••••••-••••-••••-••••-••••••••••••"}
      </code>
      <button onClick={() => setRevealed((r) => !r)} className={btn}>
        {revealed ? "Hide" : "Show"}
      </button>
      <button onClick={copy} className={btn}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
