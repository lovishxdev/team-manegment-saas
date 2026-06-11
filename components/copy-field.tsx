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

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">
        {revealed ? value : "••••••••-••••-••••-••••-••••••••••••"}
      </code>
      <button
        onClick={() => setRevealed((r) => !r)}
        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
      >
        {revealed ? "Hide" : "Show"}
      </button>
      <button
        onClick={copy}
        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-indigo-500 hover:text-indigo-300"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
