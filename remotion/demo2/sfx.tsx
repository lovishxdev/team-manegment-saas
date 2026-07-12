"use client";

import { Audio, Sequence, staticFile } from "remotion";
import { SCENE_FRAMES } from "./constants";

/**
 * Sparse SaaS-explainer accents (Kenney CC0 packs: Interface Sounds + Digital
 * Audio). No music bed — just scene enters, UI reveals, and a resolve on the
 * outro. Volumes stay low so they don't fight the visuals.
 *
 * Files live in `public/sfx/` (converted from the Kenney .ogg originals).
 */

const S = SCENE_FRAMES;

/** Absolute frame where each scene starts. */
const AT = {
  intro: 0,
  problem: S.intro,
  capture: S.intro + S.problem,
  surfaces: S.intro + S.problem + S.capture,
  discussion: S.intro + S.problem + S.capture + S.surfaces,
  dreaming: S.intro + S.problem + S.capture + S.surfaces + S.discussion,
  outro:
    S.intro +
    S.problem +
    S.capture +
    S.surfaces +
    S.discussion +
    S.dreaming,
} as const;

type Cue = {
  /** Absolute frame to fire. */
  at: number;
  file: "whoosh" | "pop" | "tick" | "confirm" | "pluck" | "soft";
  volume?: number;
};

/**
 * Cue sheet — keep it sparse. Roughly one accent per major beat, not per
 * micro-animation. No soft-rise / scene-enter rise tones.
 */
const CUES: Cue[] = [
  // Problem — headline pluck
  { at: AT.problem + 12, file: "pluck", volume: 0.28 },

  // Capture — bounced cohorts
  { at: AT.capture + 64, file: "pop", volume: 0.38 },
  { at: AT.capture + 116, file: "pop", volume: 0.38 },
  { at: AT.capture + 160, file: "tick", volume: 0.34 },

  // Surfaces — brain + connectors
  { at: AT.surfaces + 14, file: "pluck", volume: 0.26 },
  { at: AT.surfaces + 48, file: "tick", volume: 0.22 },

  // Discussion — agent answer
  { at: AT.discussion + 66, file: "confirm", volume: 0.36 },

  // Dreaming — phase ticks
  { at: AT.dreaming + 28, file: "tick", volume: 0.2 },
  { at: AT.dreaming + 96, file: "tick", volume: 0.2 },
  { at: AT.dreaming + 164, file: "pluck", volume: 0.24 },

  // Outro — CTA resolve
  { at: AT.outro + 30, file: "confirm", volume: 0.4 },
];

function CueAudio({ file, volume = 0.35 }: { file: Cue["file"]; volume?: number }) {
  return (
    <Audio
      src={staticFile(`sfx/${file}.mp3`)}
      volume={volume}
      // Don't let a long sample bleed past the next cue awkwardly.
      endAt={90}
    />
  );
}

/** Mount once at the composition root — cues are absolute-timed. */
export function Demo2Sfx() {
  return (
    <>
      {CUES.map((c, i) => (
        <Sequence key={`${c.file}-${c.at}-${i}`} from={c.at} layout="none">
          <CueAudio file={c.file} volume={c.volume} />
        </Sequence>
      ))}
    </>
  );
}

/**
 * Light under-bed music (Kevin MacLeod — Carefree, CC BY 3.0). Kept quiet so
 * SFX accents stay readable. Toggle via the `music` composition prop.
 */
export function Demo2Music() {
  return (
    <Audio
      src={staticFile("sfx/music.mp3")}
      volume={0.38}
    />
  );
}
