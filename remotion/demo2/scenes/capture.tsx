"use client";

import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LandingStyles } from "@/app/landing/_components/landing-styles";
import { WorkspaceMemoryStage } from "@/app/landing/_components/workspace-memory-stage";
import { SCENE_FRAMES } from "../constants";
import { Caption, EntranceUp, useSceneFade } from "../ui";

/** Frame → chapter stops. Newly revealed items (matching `data-from`) bounce in. */
const STOPS = [
  { f: 0, ch: 0 },
  { f: 64, ch: 2 },
  { f: 116, ch: 3 },
  { f: 160, ch: 4 },
];

const BOUNCE = { damping: 11, mass: 0.55, stiffness: 160 } as const;

/** Spring progress for items that first appear at `start`. */
function useBounceAt(start: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - start,
    fps,
    config: BOUNCE,
  });
  return {
    y: `${interpolate(p, [0, 1], [20, 0]).toFixed(2)}px`,
    scale: interpolate(p, [0, 1], [0.9, 1]).toFixed(4),
    opacity: interpolate(p, [0, 0.4], [0, 1], {
      extrapolateRight: "clamp",
    }).toFixed(3),
  };
}

export function CaptureScene() {
  const opacity = useSceneFade(SCENE_FRAMES.capture);
  const frame = useCurrentFrame();

  let idx = 0;
  for (let i = 0; i < STOPS.length; i++) {
    if (frame >= STOPS[i].f) idx = i;
  }
  const chapter = STOPS[idx].ch;

  // Bounce only newly arriving cohorts — Lina/Aarav (from: 0) are already there.
  const b2 = useBounceAt(64); // Cursor + first memory cards
  const b3 = useBounceAt(116); // Claude Code + more memory
  const b4 = useBounceAt(160); // @euclis + insight + reading badge

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center" }}>
      <LandingStyles />
      <style>{`
        .d2-stage .lp-wms-in { animation: none !important; }
        .d2-stage .lp-typing i { animation: none !important; opacity: 0.5 !important; }
        .d2-stage .lp-mem-empty::after { display: none !important; }
        .d2-stage .lp-mem-radar::before,
        .d2-stage .lp-mem-radar::after { animation: none !important; opacity: 0.35 !important; }
        .d2-stage .lp-wms-agent { animation: none !important; }

        /* Opening messages (Lina / Aarav) stay put — only later cohorts bounce. */
        .d2-stage [data-from="2"] {
          opacity: var(--d2-b2-op);
          transform: translateY(var(--d2-b2-y)) scale(var(--d2-b2-s));
          transform-origin: center top;
        }
        .d2-stage [data-from="3"] {
          opacity: var(--d2-b3-op);
          transform: translateY(var(--d2-b3-y)) scale(var(--d2-b3-s));
          transform-origin: center top;
        }
        .d2-stage [data-from="4"] {
          opacity: var(--d2-b4-op);
          transform: translateY(var(--d2-b4-y)) scale(var(--d2-b4-s));
          transform-origin: center top;
        }
      `}</style>

      <div style={{ marginTop: 88 }}>
        <EntranceUp start={4}>
          <Caption>Captured from every surface — turned into memory.</Caption>
        </EntranceUp>
      </div>

      <div
        style={{
          position: "absolute",
          top: 226,
          transform: "scale(1.3)",
          transformOrigin: "top center",
        }}
      >
        <EntranceUp start={10} distance={18} length={18}>
          <div
            className="d2-stage"
            style={
              {
                width: 1180,
                ["--d2-b2-op"]: b2.opacity,
                ["--d2-b2-y"]: b2.y,
                ["--d2-b2-s"]: b2.scale,
                ["--d2-b3-op"]: b3.opacity,
                ["--d2-b3-y"]: b3.y,
                ["--d2-b3-s"]: b3.scale,
                ["--d2-b4-op"]: b4.opacity,
                ["--d2-b4-y"]: b4.y,
                ["--d2-b4-s"]: b4.scale,
              } as CSSProperties
            }
          >
            <WorkspaceMemoryStage chapter={chapter} view="split" />
          </div>
        </EntranceUp>
      </div>
    </AbsoluteFill>
  );
}
