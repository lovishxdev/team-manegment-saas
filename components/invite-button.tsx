"use client";

import { useState, useTransition } from "react";
import { createInviteAction } from "@/lib/actions/workspace";

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
      <button
        onClick={generate}
        disabled={pending}
        className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-60"
      >
        {pending ? "Generating..." : "Invite members"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {link && (
        <button
          onClick={copy}
          className="max-w-xs truncate rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
          title="Click to copy"
        >
          {copied ? "Copied!" : link}
        </button>
      )}
    </div>
  );
}
