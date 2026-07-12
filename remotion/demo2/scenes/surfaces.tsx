"use client";

import type { ReactNode } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { ClaudeIcon } from "@/components/brand/claude-icon";
import { CursorIcon } from "@/components/brand/cursor-icon";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { SCENE_FRAMES } from "../constants";
import {
  Caption,
  DISPLAY,
  EntranceUp,
  INK,
  INK_FAINT,
  INK_SOFT,
  LINE,
  MONO,
  PopIn,
  useSceneFade,
} from "../ui";

const BRAIN = { x: 960, y: 560 };

type Node = {
  key: string;
  box: { left: number; top: number };
  center: { x: number; y: number };
  icon: ReactNode;
  label: string;
  chipBg: string;
  chipFg: string;
  /** The surface's own brand colour — drives its connector line + travelling dot. */
  dot: string;
  line: string;
  delay: number;
};

const CARD_W = 396;
const CARD_H = 152;

/** Four concrete moments — mix of captures and pulls, no read/write labels.
 *  The ping-pong dots already sell the two-way flow. */
const NODES: Node[] = [
  {
    key: "whatsapp",
    box: { left: 210, top: 250 },
    center: { x: 210 + CARD_W / 2, y: 250 + CARD_H / 2 },
    icon: <WhatsAppIcon className="h-full w-full" />,
    label: "WhatsApp",
    chipBg: "#DCF8C6",
    chipFg: "#0f7a63",
    dot: "#25D366",
    line: 'Aarav: "let\u2019s go with Supabase Auth"',
    delay: 16,
  },
  {
    key: "cursor",
    box: { left: 1314, top: 250 },
    center: { x: 1314 + CARD_W / 2, y: 250 + CARD_H / 2 },
    icon: <CursorIcon className="h-full w-full" />,
    label: "Cursor",
    chipBg: "rgba(20,20,20,0.07)",
    chipFg: "#141414",
    dot: "#141414",
    line: "Pulled auth decisions before scaffolding",
    delay: 22,
  },
  {
    key: "claudecode",
    box: { left: 210, top: 700 },
    center: { x: 210 + CARD_W / 2, y: 700 + CARD_H / 2 },
    icon: <ClaudeIcon className="h-full w-full" />,
    label: "Claude Code",
    chipBg: "#f4e7d6",
    chipFg: "#b0562f",
    dot: "#c15f3c",
    line: "Flagged a blocker: RLS before beta",
    delay: 28,
  },
  {
    key: "claude",
    box: { left: 1314, top: 700 },
    center: { x: 1314 + CARD_W / 2, y: 700 + CARD_H / 2 },
    icon: <ClaudeIcon className="h-full w-full" />,
    label: "Claude",
    chipBg: "#f4e7d6",
    chipFg: "#b0562f",
    dot: "#d97757",
    line: '"Where did auth land?" \u2192 6 decisions',
    delay: 34,
  },
];

function Connectors({ start }: { start: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {NODES.map((n, i) => {
          const drawn = Math.max(
            0,
            Math.min(1, (frame - (n.delay + 16)) / 20),
          );
          const color = n.dot;
          // Two-way pulse on every surface: card ↔ brain.
          const speed = 0.013;
          const frac = (((frame - start) * speed + i * 0.22) % 1 + 1) % 1;
          const tri = 1 - Math.abs(1 - 2 * frac); // 0 → 1 → 0
          const t = tri * tri * (3 - 2 * tri);
          const dotX = n.center.x + (BRAIN.x - n.center.x) * t;
          const dotY = n.center.y + (BRAIN.y - n.center.y) * t;
          const dx = BRAIN.x - n.center.x;
          const dy = BRAIN.y - n.center.y;
          const len = Math.hypot(dx, dy);
          return (
            <g key={n.key}>
              <line
                x1={n.center.x}
                y1={n.center.y}
                x2={n.center.x + dx * drawn}
                y2={n.center.y + dy * drawn}
                stroke={color}
                strokeOpacity={0.28}
                strokeWidth={2.5}
                strokeDasharray="2 9"
                strokeLinecap="round"
              />
              {frame > start && len > 0 ? (
                <circle cx={dotX} cy={dotY} r={7} fill={color} opacity={0.9} />
              ) : null}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

function SurfaceCard({ node }: { node: Node }) {
  return (
    <PopIn
      start={node.delay}
      style={{ position: "absolute", left: node.box.left, top: node.box.top }}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 22,
          border: `1px solid ${LINE}`,
          background: "#ffffff",
          boxShadow: "0 30px 80px -40px rgba(20,20,30,0.4)",
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              display: "grid",
              placeItems: "center",
              background: node.chipBg,
              color: node.key === "whatsapp" ? "#25D366" : node.chipFg,
            }}
          >
            <span style={{ display: "inline-flex", width: 26, height: 26 }}>
              {node.icon}
            </span>
          </span>
          <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 700, color: INK }}>
            {node.label}
          </span>
        </div>
        <p style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 500, color: INK_SOFT }}>
          {node.line}
        </p>
      </div>
    </PopIn>
  );
}

export function SurfacesScene() {
  const opacity = useSceneFade(SCENE_FRAMES.surfaces);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", top: 74, width: "100%", display: "flex", justifyContent: "center" }}>
        <EntranceUp start={4}>
          <Caption sub="Humans and agents share the same context — in and out.">
            One brain. Every surface.
          </Caption>
        </EntranceUp>
      </div>

      <Connectors start={48} />

      {NODES.map((n) => (
        <SurfaceCard key={n.key} node={n} />
      ))}

      {/* Center: the project brain */}
      <PopIn
        start={10}
        style={{
          position: "absolute",
          left: BRAIN.x - 160,
          top: BRAIN.y - 150,
        }}
      >
        <div
          style={{
          width: 320,
          height: 300,
          borderRadius: 28,
          border: "1px solid rgba(20,20,30,0.08)",
          background:
            "radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #f7f5f1 100%)",
          boxShadow: "0 40px 110px -40px rgba(20,20,30,0.38)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: 24,
            textAlign: "center",
          }}
        >
          <Img
            src={staticFile("euclis-logo.png")}
            style={{ width: 76, height: 76, borderRadius: 20, boxShadow: "0 14px 40px -18px rgba(20,20,30,0.45)" }}
          />
          <span style={{ fontFamily: DISPLAY, fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
            Project memory
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 14,
              fontWeight: 600,
              color: INK_FAINT,
            }}
          >
            6 decisions · 1 open blocker
          </span>
        </div>
      </PopIn>
    </AbsoluteFill>
  );
}
