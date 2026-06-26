"use client";

import { useState, useTransition } from "react";
import { createInviteAction } from "@/lib/actions/workspace";
import { ui } from "@/components/ui/ui";

export function InviteButton({
  workspaceId,
  variant = "default",
}: {
  workspaceId: string;
  variant?: "default" | "pill";
}) {
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

  const pillCls =
    "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink-soft shadow-sm transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div
      className={
        variant === "pill"
          ? "relative flex flex-col items-end"
          : "flex flex-col items-end gap-2"
      }
    >
      <button
        onClick={generate}
        disabled={pending}
        aria-busy={pending}
        className={variant === "pill" ? pillCls : ui.btnPrimary}
      >
        {variant === "pill" ? "+ Invite" : "+ Invite members"}
      </button>
      {error && (
        <p
          className={`text-xs text-red-600 ${variant === "pill" ? "absolute right-0 top-full mt-2 whitespace-nowrap" : ""}`}
        >
          {error}
        </p>
      )}
      {link && (
        <div
          className={
            variant === "pill"
              ? "absolute right-0 top-full z-10 mt-2 w-72 rounded-xl border border-line bg-paper p-3 shadow-md"
              : undefined
          }
        >
          {variant === "pill" && (
            <p className="mb-2 text-xs text-ink-soft">Share this invite link</p>
          )}
          <button
            onClick={copy}
            className="w-full truncate rounded-lg border border-line bg-card px-3 py-1.5 text-left font-mono text-xs text-ink-soft transition hover:text-ink"
            title="Click to copy"
          >
            {copied ? "Copied!" : link}
          </button>
        </div>
      )}
    </div>
  );
}
