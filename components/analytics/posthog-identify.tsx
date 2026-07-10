"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/analytics/posthog-client";

/**
 * Identifies the signed-in user to PostHog, or hard-excludes them.
 *
 * Exclusion is decided once on the server (see lib/analytics/opt-out.ts) and
 * passed as `optOut`. When true we call `opt_out_capturing()`, which PostHog
 * persists locally and uses to short-circuit *all* future captures with no
 * network, latency, or per-event checks. There are no conditionals sprinkled
 * through the app — analytics simply never fires for that user again.
 */
export function PostHogIdentify({
  distinctId,
  email,
  optOut,
}: {
  distinctId: string;
  email: string | null;
  optOut: boolean;
}) {
  useEffect(() => {
    const ph = initPostHog();
    if (!ph) return;

    if (optOut) {
      if (!ph.has_opted_out_capturing()) ph.opt_out_capturing();
      return;
    }

    // Re-enable if a shared machine previously opted this browser out.
    if (ph.has_opted_out_capturing()) ph.opt_in_capturing();
    ph.identify(distinctId, email ? { email } : undefined);
  }, [distinctId, email, optOut]);

  return null;
}
