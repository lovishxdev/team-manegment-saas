"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DEMO_SCENE_CAPTION_CLASS,
  DEMO_SCENE_SUBTEXT_CLASS,
} from "@/marketing/social/_components/demo-scene-caption";

type RecordCanvasProps = {
  children: ReactNode;
  /** Plain top caption (no pill/bar). */
  caption?: string;
  /** Plain bottom line (no pill/bar). */
  footer?: string;
};

/** Full-viewport canvas for window screen recording. */
export function RecordCanvas({ children, caption, footer }: RecordCanvasProps) {
  useEffect(() => {
    document.documentElement.classList.add("mkt-recording");
    return () => document.documentElement.classList.remove("mkt-recording");
  }, []);

  return (
    <div
      id="mkt-recording-frame"
      className="mkt-bg-mesh fixed inset-0 z-50 flex flex-col overflow-hidden"
    >
      {caption ? (
        <div className="pointer-events-none absolute inset-x-0 top-[3.5vh] z-30 px-[clamp(1rem,3vw,2.5rem)] text-center">
          <p className={`mkt-caption ${DEMO_SCENE_CAPTION_CLASS}`}>{caption}</p>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>

      {footer ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[3vh] z-30 px-[clamp(1rem,3vw,2.5rem)] text-center">
          <p className={`mkt-caption ${DEMO_SCENE_SUBTEXT_CLASS} font-medium`}>
            {footer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
