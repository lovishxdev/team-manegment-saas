"use client";

import { useState, useTransition } from "react";
import { revokeInviteAction } from "@/lib/actions/workspace";

export function InviteRow({
  workspaceId,
  invite,
}: {
  workspaceId: string;
  invite: {
    id: string;
    usesCount: number;
    maxUses: number;
    expiresAt: string;
    active: boolean;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite/${invite.id}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function revoke() {
    if (!window.confirm("Revoke this invite link? It stops working immediately."))
      return;
    setError(null);
    startTransition(async () => {
      const result = await revokeInviteAction(workspaceId, invite.id);
      if (result.error) setError(result.error);
    });
  }

  const smallBtn =
    "rounded-md border border-line-strong px-2.5 py-1 text-xs text-ink-soft transition disabled:opacity-60";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-ink">
            /invite/{invite.id.slice(0, 8)}…
          </p>
          <p className="text-xs text-ink-faint">
            {invite.usesCount}/{invite.maxUses} uses ·{" "}
            {invite.active
              ? `expires ${new Date(invite.expiresAt).toLocaleString("en-GB")}`
              : new Date(invite.expiresAt) < new Date()
                ? "expired"
                : "exhausted"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {invite.active && (
            <button
              onClick={copy}
              className={`${smallBtn} hover:border-ink/40 hover:text-ink`}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          )}
          <button
            onClick={revoke}
            disabled={pending}
            className={`${smallBtn} hover:border-red-500/50 hover:text-red-300`}
          >
            Revoke
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
