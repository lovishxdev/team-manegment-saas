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

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-zinc-300">
            /invite/{invite.id.slice(0, 8)}…
          </p>
          <p className="text-xs text-zinc-500">
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
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-indigo-500 hover:text-indigo-300"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          )}
          <button
            onClick={revoke}
            disabled={pending}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-60"
          >
            Revoke
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
