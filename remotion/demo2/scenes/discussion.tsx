"use client";

import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Globe } from "lucide-react";
import { ClaudeIcon } from "@/components/brand/claude-icon";
import { CursorIcon } from "@/components/brand/cursor-icon";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { DiscussionShowcase } from "@/app/landing/_components/discussion-showcase";
import { LandingStyles } from "@/app/landing/_components/landing-styles";
import { SCENE_FRAMES } from "../constants";
import { Caption, EntranceUp, useSceneFade } from "../ui";

/** Frame at which the agent's "reading…" flips to the finished summary. */
const ANSWER_AT = 66;

/** Source squares peeking from behind the larger discussion card — same motif
 *  as the landing capture beat, but introduced here where the UI has room. */
type Square = {
  key: string;
  side: "left" | "right";
  x: number;
  y: number;
  tilt: number;
  delay: number;
  color?: string;
  icon: ReactNode;
};

const SQUARES: Square[] = [
  { key: "whatsapp", side: "left", x: 340, y: 300, tilt: -8, delay: 22, color: "#25D366", icon: <WhatsAppIcon className="h-full w-full" /> },
  { key: "claudecode", side: "left", x: 320, y: 720, tilt: -5, delay: 34, color: "#c15f3c", icon: <ClaudeIcon className="h-full w-full" /> },
  { key: "cursor", side: "right", x: 1580, y: 280, tilt: 7, delay: 28, icon: <CursorIcon className="h-full w-full" /> },
  { key: "web", side: "right", x: 1600, y: 740, tilt: 8, delay: 40, color: "#0369a1", icon: <Globe className="h-full w-full" /> },
];

function PeekSquare({ sq }: { sq: Square }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [sq.delay, sq.delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const tuck = sq.side === "left" ? 72 : -72;
  return (
    <div
      style={{
        position: "absolute",
        left: sq.x - 50,
        top: sq.y,
        opacity: interpolate(p, [0, 0.35, 1], [0, 1, 1]),
        transform: `translateX(${(1 - p) * tuck}px) rotate(${sq.tilt}deg)`,
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 24,
          background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 24px 56px -18px rgba(20,20,30,0.42)",
          display: "grid",
          placeItems: "center",
          color: sq.color,
        }}
      >
        <span style={{ display: "inline-flex", width: 52, height: 52 }}>
          {sq.icon}
        </span>
      </div>
    </div>
  );
}

export function DiscussionScene() {
  const opacity = useSceneFade(SCENE_FRAMES.discussion);
  const frame = useCurrentFrame();
  const answered = frame >= ANSWER_AT;

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center" }}>
      <LandingStyles />
      {/* Remotion renders each frame independently, so CSS transitions/keyframes
          can't tween. Neutralize them; the reading→summary swap is driven by the
          frame-based `answered` flag instead. */}
      <style>{`
        .d2-disc .lp-disc-spin { animation: none !important; }
        .d2-disc .lp-disc-dots i { animation: none !important; opacity: 0.6 !important; }
        .d2-disc .lp-disc-reading,
        .d2-disc .lp-disc-answer { transition: none !important; }
      `}</style>

      <div style={{ marginTop: 64 }}>
        <EntranceUp start={4}>
          <Caption sub="An agent reads the whole thread — and catches everyone up.">
            Discussions that catch you up.
          </Caption>
        </EntranceUp>
      </div>

      {/* Squares render first so the card (painted after) hides their inner half. */}
      {SQUARES.map((sq) => (
        <PeekSquare key={sq.key} sq={sq} />
      ))}

      <div
        style={{
          position: "absolute",
          top: 230,
          transform: "scale(1.42)",
          transformOrigin: "top center",
        }}
      >
        <EntranceUp start={12} distance={22} length={20}>
          <div className="d2-disc" style={{ width: 680, position: "relative" }}>
            <DiscussionShowcase answered={answered} showPoints={false} />
          </div>
        </EntranceUp>
      </div>
    </AbsoluteFill>
  );
}
