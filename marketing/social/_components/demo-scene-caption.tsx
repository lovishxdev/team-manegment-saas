import type { ReactNode } from "react";

/** Top caption — matches across WhatsApp, Claude, web, intro, and outro scenes. */
export const DEMO_SCENE_CAPTION_CLASS =
  "text-[clamp(1.5rem,3vw,2.75rem)] font-semibold leading-tight tracking-tight text-[#1a1a1a]";

export const DEMO_SCENE_SUBTEXT_CLASS =
  "text-[clamp(1.05rem,1.85vw,1.5rem)] leading-snug text-[#6b7280]";

export function DemoSceneCaption({ children }: { children: ReactNode }) {
  return <p className={DEMO_SCENE_CAPTION_CLASS}>{children}</p>;
}

export function DemoSceneCaptionSlot({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[3.5vh] z-10 px-[clamp(1rem,3vw,2.5rem)] text-center">
      {children}
    </div>
  );
}
