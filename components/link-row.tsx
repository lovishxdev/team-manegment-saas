"use client";

import { useState, useTransition } from "react";
import {
  deleteLinkAction,
  toggleLinkPinAction,
} from "@/lib/actions/workspace";

export type LinkItem = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  pinned: boolean;
  creatorLabel: string;
  createdAt: string;
};

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path
        d="M8 1.5 9.6 5.8l4.6.4-3.5 3 1 4.5L8 11.8 4.3 13.7l1-4.5-3.5-3 4.6-.4L8 1.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkRow({
  workspaceId,
  link,
}: {
  workspaceId: string;
  link: LinkItem;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePin() {
    setError(null);
    startTransition(async () => {
      const result = await toggleLinkPinAction(workspaceId, link.id);
      if (result.error) setError(result.error);
    });
  }

  function remove() {
    if (!window.confirm(`Remove "${link.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteLinkAction(workspaceId, link.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <article
      className={`group rounded-xl border bg-paper p-4 shadow-sm transition ${
        link.pinned ? "border-orange-200/80" : "border-line"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-base font-semibold text-ink transition hover:text-orange-600"
            >
              {link.title}
            </a>
            {link.pinned ? (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-700">
                Pinned
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-ink-soft">
            {hostLabel(link.url)}
          </p>
          {link.description ? (
            <p className="mt-2 text-sm text-ink-soft">{link.description}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-ink-faint">
            Added by @{link.creatorLabel} ·{" "}
            {new Date(link.createdAt).toLocaleDateString("en-GB")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={togglePin}
            disabled={pending}
            title={link.pinned ? "Unpin link" : "Pin link"}
            aria-label={link.pinned ? "Unpin link" : "Pin link"}
            className={`rounded-lg p-2 transition disabled:opacity-50 ${
              link.pinned
                ? "text-orange-500 hover:bg-orange-50"
                : "text-ink-faint hover:bg-paper-deep/80 hover:text-ink"
            }`}
          >
            <PinIcon filled={link.pinned} />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            title="Remove link"
            aria-label="Remove link"
            className="rounded-lg p-2 text-ink-faint transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            ×
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </article>
  );
}
