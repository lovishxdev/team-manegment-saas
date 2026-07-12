"use client";

import { AbsoluteFill, Series } from "remotion";
import { SCENE_FRAMES } from "./constants";
import { Demo2Music, Demo2Sfx } from "./sfx";
import { DISPLAY, MESH_BACKGROUND } from "./ui";
import { IntroScene } from "./scenes/intro";
import { ProblemScene } from "./scenes/problem";
import { CaptureScene } from "./scenes/capture";
import { SurfacesScene } from "./scenes/surfaces";
import { DiscussionScene } from "./scenes/discussion";
import { DreamingScene } from "./scenes/dreaming";
import { OutroScene } from "./scenes/outro";

export type Demo2Props = {
  /** Light under-bed music. Default on; pass `false` to omit. */
  music?: boolean;
  /** Sparse UI accent SFX. Default on; pass `false` for a fully silent cut. */
  sfx?: boolean;
};

/**
 * Euclis demo reel #2 (~34s): intro → problem → capture into memory (the real
 * landing stage) → one brain / every surface → discussions that catch you up →
 * dreaming (memory maintains itself) → outro. Frame-driven so it renders
 * deterministically in both the Player and the Remotion CLI. Sparse free
 * stock SFX accents ride along via Demo2Sfx; optional light music via `music`.
 */
export function Demo2({ music = true, sfx = true }: Demo2Props) {
  return (
    <AbsoluteFill style={{ background: MESH_BACKGROUND, fontFamily: DISPLAY }}>
      {music ? <Demo2Music /> : null}
      {sfx ? <Demo2Sfx /> : null}
      <Series>
        <Series.Sequence durationInFrames={SCENE_FRAMES.intro}>
          <IntroScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.problem}>
          <ProblemScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.capture}>
          <CaptureScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.surfaces}>
          <SurfacesScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.discussion}>
          <DiscussionScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.dreaming}>
          <DreamingScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_FRAMES.outro}>
          <OutroScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
}
