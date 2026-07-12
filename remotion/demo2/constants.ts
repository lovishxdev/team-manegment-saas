export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Per-scene durations in frames (@30fps). Tightened for a faster cut. */
export const SCENE_FRAMES = {
  intro: 60,
  problem: 96,
  capture: 200,
  surfaces: 184,
  discussion: 190,
  dreaming: 200,
  outro: 96,
} as const;

export const TOTAL_FRAMES = Object.values(SCENE_FRAMES).reduce(
  (sum, n) => sum + n,
  0,
);

/** Frames spent fading each scene in / out. */
export const SCENE_FADE = 12;
