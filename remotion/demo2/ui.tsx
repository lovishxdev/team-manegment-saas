"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SCENE_FADE } from "./constants";
import { BRAND, FONT } from "./fonts";

export { BRAND };

/**
 * Exact landing-hero backdrop (`.lp-story-bg`): soft warm gold left, soft pink
 * right, over paper. Matches the scroll-story hero — not the denser CTA mesh.
 */
export const MESH_BACKGROUND =
  "radial-gradient(ellipse 45% 55% at 8% 6%, rgba(255, 220, 150, 0.18) 0%, transparent 55%)," +
  "radial-gradient(ellipse 45% 55% at 94% 10%, rgba(255, 200, 214, 0.14) 0%, transparent 55%)," +
  "#fbfaf9";

export const INK = "#141414";
export const INK_SOFT = "#5b616e";
export const INK_FAINT = "#9ca3af";
export const LINE = "#e5e7eb";
/** One strong sans for the whole reel (headlines + body). */
export const DISPLAY = FONT;
export const MONO =
  "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)";

/** Opacity that eases a scene in at the start and out before its end. */
export function useSceneFade(durationInFrames: number, fade = SCENE_FADE) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, fade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - fade, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return Math.min(enter, exit);
}

/** 0→1 eased reveal starting at `start`, over `length` frames. */
export function reveal(frame: number, start: number, length = 16) {
  return interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

/** Springy pop for cards/elements appearing at `start`. */
export function usePop(start: number, fps: number) {
  const frame = useCurrentFrame();
  return spring({
    frame: frame - start,
    fps,
    config: { damping: 200, mass: 0.6, stiffness: 120 },
  });
}

/** Number of characters of `text` to show, typed out between two frames. */
export function typed(text: string, frame: number, start: number, end: number) {
  const n = Math.floor(
    interpolate(frame, [start, end], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return text.slice(0, n);
}

export function EntranceUp({
  start,
  children,
  distance = 26,
  length = 16,
  style,
}: {
  start: number;
  children: ReactNode;
  distance?: number;
  length?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const p = reveal(frame, start, length);
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * distance}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PopIn({
  start,
  children,
  style,
}: {
  start: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { fps } = useVideoConfig();
  const p = usePop(start, fps);
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `translateY(${(1 - p) * 12}px) scale(${0.94 + 0.06 * p})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const KIND_STYLES: Record<string, { bg: string; fg: string }> = {
  DECISION: { bg: "#f5f3ff", fg: "#7c3aed" },
  BLOCKER: { bg: "#fff1f2", fg: "#e11d48" },
  MILESTONE: { bg: "#ecfdf5", fg: "#059669" },
  DEPENDENCY: { bg: "#fffbeb", fg: "#b45309" },
  INSIGHT: { bg: "#eff6ff", fg: "#0284c7" },
};

export function KindChip({ kind }: { kind: keyof typeof KIND_STYLES | string }) {
  const s = KIND_STYLES[kind] ?? KIND_STYLES.DECISION;
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: 6,
        padding: "3px 9px",
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.06em",
        background: s.bg,
        color: s.fg,
      }}
    >
      {kind}
    </span>
  );
}

export function Caption({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <p
        style={{
          fontFamily: DISPLAY,
          fontSize: 60,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: INK,
          lineHeight: 1.03,
        }}
      >
        {children}
      </p>
      {sub ? (
        <p
          style={{
            marginTop: 16,
            fontFamily: DISPLAY,
            fontSize: 30,
            fontWeight: 500,
            color: INK_SOFT,
          }}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
