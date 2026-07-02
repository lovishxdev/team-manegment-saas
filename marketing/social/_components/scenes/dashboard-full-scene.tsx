"use client";

import { useEffect, useState } from "react";
import { DashboardPreview } from "@/app/landing/_components/dashboard-preview";
import {
  DemoSceneCaption,
  DemoSceneCaptionSlot,
} from "@/marketing/social/_components/demo-scene-caption";

/** Landing dashboard preview — quick board ↔ whiteboard glimpse for the full reel. */
export function DashboardFullScene() {
  const [showBridge, setShowBridge] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShowBridge(true), 5200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-[clamp(1rem,3vw,2.5rem)] pb-[clamp(1.25rem,3.5vh,2.5rem)] pt-[clamp(4rem,10vh,6.5rem)]">
      <DemoSceneCaptionSlot>
        <DemoSceneCaption>Web dashboard · kanban and whiteboard</DemoSceneCaption>
      </DemoSceneCaptionSlot>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[min(58vw,860px)]">
          <DashboardPreview recordingMode />
        </div>
      </div>

      <div
        className={`mkt-scene-fade pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-[6vw] text-center ${
          showBridge ? "bg-[#f4f3ee]/82 opacity-100" : "opacity-0"
        }`}
        aria-hidden={!showBridge}
      >
        <DemoSceneCaption>Same board. Same truth.</DemoSceneCaption>
      </div>
    </div>
  );
}
