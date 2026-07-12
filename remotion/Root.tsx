import { Composition } from "remotion";
import { Demo2, type Demo2Props } from "./demo2/Demo2";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./demo2/constants";
import "./style.css";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="Demo2"
        component={Demo2}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ music: true, sfx: true } satisfies Demo2Props}
      />
      {/* Same reel, SFX only — handy for a silent cut or voiceover later. */}
      <Composition
        id="Demo2NoMusic"
        component={Demo2}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ music: false, sfx: true } satisfies Demo2Props}
      />
      {/* Fully silent — no music, no SFX. */}
      <Composition
        id="Demo2Silent"
        component={Demo2}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ music: false, sfx: false } satisfies Demo2Props}
      />
    </>
  );
};
