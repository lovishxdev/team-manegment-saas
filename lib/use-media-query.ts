import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. Server + first client paint return `false`
 * so SSR markup stays deterministic; the real value applies after hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () =>
      typeof window.matchMedia === "function"
        ? window.matchMedia(query).matches
        : false,
    () => false
  );
}

/** Matches Tailwind `md` (768px) — true when the board is stacked (1 column). */
export function useIsMobileBoard(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
