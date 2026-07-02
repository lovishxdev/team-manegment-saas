"use client";

import {
  DEMO_SCENE_CAPTION_CLASS,
  DEMO_SCENE_SUBTEXT_CLASS,
} from "@/marketing/social/_components/demo-scene-caption";

export function OutroScene() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-[6vw] text-center">
      <div className="mkt-caption flex max-w-2xl flex-col items-center gap-3">
        <p className={DEMO_SCENE_CAPTION_CLASS}>Same board. Same truth.</p>
        <p className={DEMO_SCENE_SUBTEXT_CLASS}>
          Hackathons, side projects, study groups, WhatsApp-first teams
        </p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <span className="rounded-full bg-[#1a1a1a] px-8 py-3 text-[clamp(1.1rem,2vw,1.5rem)] font-semibold text-white shadow-lg">
            euclis.dev
          </span>
          <span className={`${DEMO_SCENE_SUBTEXT_CLASS} font-medium`}>
            Completely free, no credit card
          </span>
        </div>
      </div>
    </div>
  );
}
