"use client";

import { Player } from "@remotion/player";
import { Demo2 } from "./Demo2";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./constants";

/**
 * In-browser preview of the Demo2 reel. Fills its container while keeping the
 * 16:9 composition aspect — full-screen the tab and window-record for an MP4,
 * or use `npm run remotion:render` for a headless export.
 */
export function Demo2Player({
  controls = true,
  music = true,
}: {
  controls?: boolean;
  /** Light under-bed music. Default on. */
  music?: boolean;
}) {
  return (
    <Player
      component={Demo2}
      inputProps={{ music }}
      durationInFrames={TOTAL_FRAMES}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      style={{ width: "100%", height: "100%" }}
      autoPlay
      loop
      controls={controls}
      clickToPlay={false}
    />
  );
}
