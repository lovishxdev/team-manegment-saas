"use client";

import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SCENE_FRAMES } from "../constants";
import { DISPLAY, EntranceUp, INK, INK_SOFT, useSceneFade } from "../ui";

/** Buried context, scattered into the margins so it frames (never crosses) the
 *  headline. Each fades in, then settles dim — the noise you scroll through. */
// Kept in the four corners (clear of the centered headline + subhead band).
const FRAGMENTS: {
  text: string;
  x: number;
  y: number;
  delay: number;
  align: "left" | "right";
}[] = [
  { text: "did we ever decide on auth??", x: 120, y: 150, delay: 4, align: "left" },
  { text: "what was the billing blocker again", x: 1800, y: 180, delay: 12, align: "right" },
  { text: "new here — how do we do things?", x: 150, y: 830, delay: 22, align: "left" },
  { text: "scroll up… it's in here somewhere", x: 1790, y: 860, delay: 30, align: "right" },
];

function Fragment({
  text,
  x,
  y,
  delay,
  align,
}: (typeof FRAGMENTS)[number]) {
  const frame = useCurrentFrame();
  const local = frame - delay;
  const p = interpolate(local, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        position: "absolute",
        ...(align === "right" ? { right: 1920 - x } : { left: x }),
        top: y,
        transform: `translateY(${(1 - p) * 12}px)`,
        opacity: p * 0.5,
        width: "max-content",
        maxWidth: 360,
        padding: "13px 18px",
        borderRadius: 18,
        borderTopLeftRadius: align === "left" ? 5 : 18,
        borderTopRightRadius: align === "right" ? 5 : 18,
        background: "rgba(255,255,255,0.75)",
        boxShadow: "0 12px 34px -22px rgba(20,20,30,0.3)",
        fontFamily: DISPLAY,
        fontSize: 21,
        fontWeight: 500,
        color: "#6b7280",
        filter: "blur(0.3px)",
      }}
    >
      {text}
    </div>
  );
}

export function ProblemScene() {
  const opacity = useSceneFade(SCENE_FRAMES.problem);

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {FRAGMENTS.map((f) => (
          <Fragment key={f.text} {...f} />
        ))}
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 1120, padding: "0 60px" }}>
          <EntranceUp start={10}>
            <h1
              style={{
                fontFamily: DISPLAY,
                fontSize: 96,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 0.98,
                color: INK,
              }}
            >
              Context shouldn&apos;t live in scrollback.
            </h1>
          </EntranceUp>
          <EntranceUp start={28} style={{ marginTop: 30 }}>
            <p
              style={{
                fontFamily: DISPLAY,
                fontSize: 34,
                fontWeight: 500,
                lineHeight: 1.4,
                color: INK_SOFT,
              }}
            >
              Decisions get buried in chat. New teammates — and new AI
              sessions — start from zero.
            </p>
          </EntranceUp>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
