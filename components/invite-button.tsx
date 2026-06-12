"use client";

import { useState, useTransition } from "react";
import { createInviteAction } from "@/lib/actions/workspace";
import { ui } from "@/components/ui";

export function InviteButton({ workspaceId }: { workspaceId: string }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await createInviteAction(workspaceId);
      if (result.error) {
        setError(result.error);
      } else if (result.inviteId) {
        setLink(`${window.location.origin}/invite/${result.inviteId}`);
        setCopied(false);
      }
    });
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={generate} disabled={pending} className={ui.btnPrimary}>
        {pending ? "Generating..." : "+ Invite members"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {link && (
        <button
          onClick={copy}
          className="max-w-xs truncate rounded-md border border-line bg-card px-3 py-1.5 font-mono text-xs text-ink-soft transition hover:text-ink"
          title="Click to copy"
        >
          {copied ? "Copied!" : link}
        </button>
      )}
    </div>
  );
}
