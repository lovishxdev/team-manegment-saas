"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, POSTHOG_ENABLED } from "@/lib/analytics/posthog-client";

function Pageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ph = initPostHog();
    if (!ph) return;
    let url = window.location.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Global PostHog bootstrap: initializes the browser SDK and records SPA
 * pageviews on route change. Mounted once in the root layout. No-ops entirely
 * outside production or when NEXT_PUBLIC_POSTHOG_KEY is unset.
 */
export function PostHogProvider() {
  useEffect(() => {
    initPostHog();
  }, []);

  if (!POSTHOG_ENABLED) return null;

  return (
    <Suspense fallback={null}>
      <Pageviews />
    </Suspense>
  );
}
