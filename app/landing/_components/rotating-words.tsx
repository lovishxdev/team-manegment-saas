"use client";

import { useEffect, useState } from "react";

/**
 * Vertical word rotator for the hero headline.
 *
 * An invisible sizer reserves width/height; words animate inside a clipped
 * overlay so Safari doesn't paint inactive phrases in the text flow.
 */
export function RotatingWords({
  words,
  interval = 2200,
}: {
  words: { text: string; tint: string }[];
  interval?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setI((prev) => (prev + 1) % words.length),
      interval
    );
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  const longest = words.reduce(
    (a, b) => (a.text.length >= b.text.length ? a : b),
    words[0]
  );

  return (
    <span className="lp-rotator" aria-live="polite">
      <span className="lp-rotator-sizer" aria-hidden="true">
        {longest.text}
      </span>
      <span className="lp-rotator-clip">
        {words.map((w, idx) => {
          const isActive = idx === i;
          const isPrev = (idx + 1) % words.length === i;
          const transform = isActive
            ? "translate3d(-50%, 0, 0)"
            : isPrev
              ? "translate3d(-50%, -110%, 0)"
              : "translate3d(-50%, 110%, 0)";
          return (
            <span
              key={w.text}
              className={`lp-rotator-word${isActive ? " is-active" : ""}${isPrev ? " is-prev" : ""}`}
              aria-hidden={!isActive}
              style={{
                opacity: isActive ? 1 : 0,
                visibility: isActive || isPrev ? "visible" : "hidden",
                transform,
                color: w.tint,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </span>
    </span>
  );
}
