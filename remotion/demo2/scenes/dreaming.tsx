"use client";

import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Moon } from "lucide-react";
import { DreamCycle } from "@/app/landing/_components/dream-cycle";
import { LandingStyles } from "@/app/landing/_components/landing-styles";
import { SCENE_FRAMES } from "../constants";
import { FONT, SERIF } from "../fonts";
import { EntranceUp, useSceneFade } from "../ui";

/**
 * Exact landing Dreaming section — same sky, stars, eyebrow, serif headline,
 * body copy, and DreamCycle UI. Phase is driven by frame so the consolidate →
 * prune sequence plays deterministically in the Player and CLI.
 *
 * Landing advances every 1700ms (~51f @30fps). We keep a similar cadence inside
 * the scene budget so each operation has time to settle.
 */
const PHASE_START = 24;
const PHASE_LEN = 34; // ~landing's 1700ms, slightly tighter for the reel

/** Landing's moonlight sweep is 2.6s — keep the same period in frames @30fps. */
const SWEEP_FRAMES = 78; // 2.6 * 30

export function DreamingScene() {
  const opacity = useSceneFade(SCENE_FRAMES.dreaming);
  const frame = useCurrentFrame();
  const raw =
    frame < PHASE_START
      ? 0
      : Math.floor((frame - PHASE_START) / PHASE_LEN) + 1;
  const phase = Math.max(0, Math.min(5, raw));
  const dreaming = phase >= 1 && phase <= 4;

  // Frame-driven remake of `.lp-dream-panel.is-dreaming::after` — Remotion
  // freezes CSS keyframes, so we scrub `top` ourselves while dreaming.
  const sweepT = interpolate(frame % SWEEP_FRAMES, [0, SWEEP_FRAMES], [0, 1], {
    easing: Easing.inOut(Easing.sin),
  });
  const sweepTop = dreaming ? -40 + sweepT * 140 : -40; // -40% → 100%

  return (
    <AbsoluteFill style={{ opacity }}>
      <LandingStyles />
      {/* Wire the same CSS font variables the landing uses, so Tailwind
          `font-serif` / `font-sans` / `font-mono` resolve in the CLI too. */}
      <style>{`
        .d2-dream {
          --font-instruments-serif: ${SERIF};
          --font-serif: ${SERIF}, ui-serif, Georgia, serif;
          --font-hanken: ${FONT};
          --font-sans: ${FONT}, ui-sans-serif, system-ui, sans-serif;
          --dream-sweep-top: ${sweepTop}%;
        }
        /* Remotion freezes CSS keyframes — neutralize loops, drive the sweep
           via --dream-sweep-top so it still reads in the Player and CLI. */
        .d2-dream .lp-dream-stars { animation: none !important; opacity: 0.55 !important; }
        .d2-dream .lp-dream-panel.is-dreaming::after {
          animation: none !important;
          display: block !important;
          top: var(--dream-sweep-top) !important;
        }
        .d2-dream .lp-dream-moon { animation: none !important; }
        .d2-dream .lp-dc-insight { animation: none !important; }
        .d2-dream .lp-dc-in { animation: none !important; }
        .d2-dream .lp-dream-cards .lp-dc-collapse { transition: none !important; }
        /* Video is a full-bleed night plate — drop the white edge fades that
           blend into neighbouring light sections on the site. */
        .d2-dream .lp-dream-fade-top,
        .d2-dream .lp-dream-fade-bottom { display: none !important; }
      `}</style>

      <div className="d2-dream lp-dream-night absolute inset-0 overflow-hidden">
        <div aria-hidden className="lp-dream-sky absolute inset-0" />
        <div aria-hidden className="lp-dream-stars absolute inset-0" />

        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "44px 72px 40px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EntranceUp start={4}>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-indigo-100 ring-1 ring-white/15 backdrop-blur">
                <Moon className="h-4 w-4" />
              </span>
              <span
                className="font-mono font-semibold uppercase tracking-[0.16em] text-indigo-200/70"
                style={{ fontSize: 14 }}
              >
                dreaming · while you&apos;re away
              </span>
            </div>
          </EntranceUp>

          <EntranceUp start={10} style={{ marginTop: 14 }}>
            <h2
              className="font-serif leading-[1.06] tracking-tight text-[#f5f4fb]"
              style={{ fontSize: 72, whiteSpace: "nowrap" }}
            >
              Your memory isn&apos;t just stored.{" "}
              <span className="font-medium italic text-white">It dreams.</span>
            </h2>
          </EntranceUp>

          <EntranceUp start={18} style={{ marginTop: 16 }}>
            <p
              className="leading-relaxed text-indigo-100/60"
              style={{ fontSize: 22, maxWidth: 920 }}
            >
              Capture only ever sees one moment. So on a schedule, Euclis takes a
              step back and tends the whole store — the way you&apos;d wish
              someone would. It merges duplicates, reconciles decisions that
              contradict, surfaces patterns no single note could see, and files
              away what&apos;s gone stale. Retrieval reads; dreaming maintains.
            </p>
          </EntranceUp>

          <EntranceUp
            start={26}
            style={{
              marginTop: 28,
              flex: 1,
            }}
          >
            <div
              style={{
                transform: "scale(1.55)",
                transformOrigin: "top left",
                width: "64.5%",
              }}
            >
              <DreamCycle phase={phase} />
            </div>
          </EntranceUp>
        </div>
      </div>
    </AbsoluteFill>
  );
}
