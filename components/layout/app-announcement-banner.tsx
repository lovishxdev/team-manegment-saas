"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { useClientMounted } from "@/lib/use-client-mounted";

const STORAGE_PREFIX = "euclis:app-banner-dismissed:";

function bannerConfig() {
  const text = process.env.NEXT_PUBLIC_APP_BANNER_TEXT?.trim() ?? "";
  if (!text) return null;

  const href = process.env.NEXT_PUBLIC_APP_BANNER_HREF?.trim() || null;
  const linkLabel =
    process.env.NEXT_PUBLIC_APP_BANNER_LINK_LABEL?.trim() || "Watch demo";
  const id =
    process.env.NEXT_PUBLIC_APP_BANNER_ID?.trim() ||
    `${text}|${href ?? ""}`;

  return { id, text, href, linkLabel };
}

/**
 * Slim top-of-app announcement. Content comes from NEXT_PUBLIC_APP_BANNER_*
 * env vars — leave TEXT empty to hide. Dismiss is per-banner-id in localStorage.
 */
export function AppAnnouncementBanner() {
  const mounted = useClientMounted();
  const config = bannerConfig();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!config) {
      setReady(true);
      return;
    }
    try {
      setDismissed(localStorage.getItem(STORAGE_PREFIX + config.id) === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, [config?.id]);

  if (!config || !mounted || !ready || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_PREFIX + config!.id, "1");
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
          <span className="text-ink">{config.text}</span>
          {config.href ? (
            <>
              {" "}
              <a
                href={config.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-ink underline decoration-ink/25 underline-offset-2 transition hover:decoration-ink"
              >
                {config.linkLabel}
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0 opacity-70"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </a>
            </>
          ) : null}
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
