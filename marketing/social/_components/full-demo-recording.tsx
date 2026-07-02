"use client";

import { useEffect, useState } from "react";
import { RecordCanvas } from "@/marketing/social/_components/record-canvas";
import { ClaudeFullScene } from "@/marketing/social/_components/scenes/claude-full-scene";
import { DashboardFullScene } from "@/marketing/social/_components/scenes/dashboard-full-scene";
import { IntroScene } from "@/marketing/social/_components/scenes/intro-scene";
import { OutroScene } from "@/marketing/social/_components/scenes/outro-scene";
import { WhatsAppFullScene } from "@/marketing/social/_components/scenes/whatsapp-full-scene";

const FADE_MS = 550;

const SCENES = [
  { id: "intro", durationMs: 2800 },
  { id: "whatsapp", durationMs: 8500 },
  { id: "claude", durationMs: 9500 },
  { id: "dashboard", durationMs: 6800 },
  { id: "outro", durationMs: 4500 },
] as const;

type SceneId = (typeof SCENES)[number]["id"];

const TOTAL_MS = SCENES.reduce((sum, s) => sum + s.durationMs, 0);

/**
 * Full compiled demo reel (~32s) for window screen recording.
 * Intro → WhatsApp → Claude → web dashboard → outro → loop.
 */
export function FullDemoRecording() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(true);
  const [showDebugTimer, setShowDebugTimer] = useState(false);

  useEffect(() => {
    setShowDebugTimer(
      process.env.NODE_ENV === "development" &&
        new URLSearchParams(window.location.search).has("debug"),
    );
  }, []);

  const active = SCENES[sceneIndex]!;

  useEffect(() => {
    setVisible(true);

    const fadeAt = Math.max(0, active.durationMs - FADE_MS);
    const fadeId = window.setTimeout(() => setVisible(false), fadeAt);
    const switchId = window.setTimeout(() => {
      setSceneIndex((idx) => {
        const next = idx + 1;
        if (next >= SCENES.length) {
          setCycle((c) => c + 1);
          return 0;
        }
        return next;
      });
    }, active.durationMs);

    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(switchId);
    };
  }, [sceneIndex, cycle, active.durationMs]);

  return (
    <RecordCanvas>
      <div
        key={`${active.id}-${cycle}`}
        className={`mkt-scene-fade relative flex min-h-0 flex-1 flex-col ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <SceneContent sceneId={active.id} />

        {showDebugTimer ? (
          <div className="pointer-events-none absolute bottom-[2.5vh] right-[2.5vw] z-40 rounded-full bg-black/55 px-3 py-1.5 font-mono text-[10px] text-white/80 backdrop-blur-sm">
            {formatElapsed(sceneIndex)} / {Math.round(TOTAL_MS / 1000)}s · {active.id}
          </div>
        ) : null}
      </div>
    </RecordCanvas>
  );
}

function SceneContent({ sceneId }: { sceneId: SceneId }) {
  switch (sceneId) {
    case "intro":
      return <IntroScene />;
    case "whatsapp":
      return <WhatsAppFullScene />;
    case "claude":
      return <ClaudeFullScene />;
    case "dashboard":
      return <DashboardFullScene />;
    case "outro":
      return <OutroScene />;
  }
}

function formatElapsed(sceneIndex: number): string {
  let ms = 0;
  for (let i = 0; i < sceneIndex; i++) ms += SCENES[i]!.durationMs;
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
