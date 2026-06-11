"use client";

import { useState, useTransition } from "react";
import { regenerateMcpTokenAction } from "@/lib/actions/settings";

export function RegenerateToken() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function regenerate() {
    if (
      !window.confirm(
        "Generate a new token? The current one stops working immediately and any connected Claude clients must be updated."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await regenerateMcpTokenAction();
      setMessage(result.message ?? result.error ?? null);
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        onClick={regenerate}
        disabled={pending}
        className="self-start rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-60"
      >
        {pending ? "Generating..." : "Regenerate token"}
      </button>
      {message && <p className="text-xs text-amber-300">{message}</p>}
    </div>
  );
}
