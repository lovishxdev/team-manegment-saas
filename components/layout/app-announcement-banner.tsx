"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { useClientMounted } from "@/lib/use-client-mounted";

/** Bump this when the message changes so dismissed users see the new banner. */
const BANNER_ID = "demo-video-2026-09";
const BANNER_TEXT =
  "Want to use Euclis to its full potential? Check out this quick demo:";
const BANNER_HREF = "https://youtu.be/0e4h8Couf6U";
const BANNER_LINK_LABEL = "Watch demo";

const STORAGE_KEY = `euclis:app-banner-dismissed:${BANNER_ID}`;

/**
 * Slim top-of-app announcement. Edit the constants above to change copy.
 * Dismiss is remembered in localStorage per BANNER_ID.
 */
export function AppAnnouncementBanner() {
  const mounted = useClientMounted();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, []);

  if (!mounted || !ready || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative z-40 border-b border-line bg-card"
    >
      <div className="flex items-start gap-3 px-4 py-2.5 sm:items-center sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-soft sm:text-sm">
          <span className="text-ink">{BANNER_TEXT}</span>{" "}
          <a
            href={BANNER_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-ink underline decoration-ink/25 underline-offset-2 transition hover:decoration-ink"
          >
            {BANNER_LINK_LABEL}
            <ExternalLink
              className="h-3.5 w-3.5 shrink-0 opacity-70"
              strokeWidth={1.75}
              aria-hidden
            />
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-ink-faint transition hover:bg-paper-deep hover:text-ink"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
