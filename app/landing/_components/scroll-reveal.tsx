"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

/**
 * Fade + lift on enter. Pure CSS class toggle via IntersectionObserver —
 * the actual animation lives in `landing-styles.tsx`, so there is no JS
 * frame loop after the element has revealed.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Stagger delay in ms */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // CSS custom properties aren't part of React.CSSProperties — cast cleanly.
  const style = {
    "--lp-reveal-delay": `${delay}ms`,
  } as CSSProperties;

  return (
    <div ref={ref} className={`lp-reveal ${className}`} style={style}>
      {children}
    </div>
  );
}
