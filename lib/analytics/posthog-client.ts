import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

/** Analytics runs in production only, and only when a key is configured. */
export const POSTHOG_ENABLED =
  process.env.NODE_ENV === "production" && Boolean(KEY);

let initialized = false;

/**
 * Idempotent PostHog init. Safe to call from multiple client components;
 * only the first call in the browser actually initializes. Returns null when
 * disabled (dev, no key, or SSR) so callers can no-op cheaply.
 */
export function initPostHog(): typeof posthog | null {
  if (!POSTHOG_ENABLED || typeof window === "undefined") return null;
  if (!initialized) {
    posthog.init(KEY as string, {
      api_host: HOST,
      // App Router: we capture $pageview manually on route change.
      capture_pageview: false,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      // Respect a previously persisted opt-out immediately on load — an
      // excluded user stays silent from the first byte, no per-event checks.
      opt_out_capturing_by_default: false,
    });
    initialized = true;
  }
  return posthog;
}

export { posthog };
