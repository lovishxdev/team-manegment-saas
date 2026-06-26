"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * While the integrations onboarding card is visible, refresh the app shell
 * when the user returns to this tab (e.g. after sending hi on WhatsApp).
 * Unmounts once chat is started — no polling, no extra realtime channels.
 */
export function WhatsAppOnboardingSync() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refreshSoon = () => {
      if (document.visibilityState !== "visible") return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => router.refresh(), 300);
    };

    document.addEventListener("visibilitychange", refreshSoon);
    window.addEventListener("focus", refreshSoon);

    return () => {
      document.removeEventListener("visibilitychange", refreshSoon);
      window.removeEventListener("focus", refreshSoon);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [router]);

  return null;
}
