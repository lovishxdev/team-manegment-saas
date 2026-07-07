"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Brief top-of-main progress flash on route changes so navigation feels responsive
 * while the next segment streams in.
 */
export function RouteLoadingBar() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden"
      aria-hidden
    >
      <div className="route-loading-bar h-full w-1/3 bg-ink/80" />
    </div>
  );
}
