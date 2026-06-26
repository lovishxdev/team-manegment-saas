"use client";

import { useState, useTransition } from "react";
import { regenerateMcpTokenAction } from "@/lib/actions/settings";
import { ui } from "@/components/ui";

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
        aria-busy={pending}
        className={`self-start ${ui.btnGhostDanger}`}
      >
        Regenerate token
      </button>
      {message && <p className="text-xs text-amber-300">{message}</p>}
    </div>
  );
}
