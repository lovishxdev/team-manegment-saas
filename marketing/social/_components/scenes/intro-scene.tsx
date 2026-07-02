"use client";

import Image from "next/image";
import {
  DEMO_SCENE_CAPTION_CLASS,
  DEMO_SCENE_SUBTEXT_CLASS,
} from "@/marketing/social/_components/demo-scene-caption";

export function IntroScene() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-[6vw] text-center">
      <div className="mkt-caption flex flex-col items-center gap-[clamp(0.75rem,2.5vh,1.5rem)]">
        <div className="flex items-center gap-4">
          <Image
            src="/euclis-logo.png"
            alt="Euclis"
            width={72}
            height={72}
            className="rounded-2xl shadow-lg ring-1 ring-black/8"
          />
          <span className="font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-medium tracking-tight text-[#1a1a1a]">
            Euclis
          </span>
        </div>

        <h1 className={`max-w-4xl ${DEMO_SCENE_CAPTION_CLASS}`}>
          Free team task board for small groups
        </h1>

        <p className={`max-w-2xl ${DEMO_SCENE_SUBTEXT_CLASS}`}>
          WhatsApp assistant · Claude MCP · web kanban · same board, real-time sync
        </p>
      </div>
    </div>
  );
}
