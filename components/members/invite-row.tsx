"use client";

import { useState, useTransition } from "react";
import { revokeInviteAction } from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

const settingsRowCls =
  "rounded-xl border border-line bg-card px-4 py-3.5 shadow-[0_1px_3px_rgba(26,26,26,0.04)]";

const actionBtnCls = "min-h-[46px] px-3.5";

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
    <div className={`flex flex-col gap-2 ${settingsRowCls}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-ink">
            /invite/{invite.id.slice(0, 8)}…
          </p>
          <p className="text-sm text-ink-faint">
            {invite.usesCount}/{invite.maxUses} uses ·{" "}
            {invite.active
              ? `expires ${new Date(invite.expiresAt).toLocaleString("en-GB")}`
              : new Date(invite.expiresAt) < new Date()
                ? "expired"
                : "exhausted"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {invite.active ? (
            <button
              type="button"
              onClick={copy}
              className={`${ui.btnSecondary} ${actionBtnCls}`}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={revoke}
            disabled={pending}
            className={`${ui.btnGhostDanger} ${actionBtnCls}`}
          >
            Revoke
          </button>
        </div>
      </div>

      {error ? <p className={ui.errorText}>{error}</p> : null}
    </div>
  );
}
