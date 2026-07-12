"use client";

import { AbsoluteFill, Img, staticFile } from "remotion";
import { SCENE_FRAMES } from "../constants";
import {
  BRAND,
  DISPLAY,
  EntranceUp,
  INK,
  INK_SOFT,
  PopIn,
  useSceneFade,
} from "../ui";

export function IntroScene() {
  const opacity = useSceneFade(SCENE_FRAMES.intro);

  return (
    <AbsoluteFill
      style={{
        opacity,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <PopIn start={2}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <Img
              src={staticFile("euclis-logo.png")}
              style={{
                width: 120,
                height: 120,
                borderRadius: 30,
                boxShadow: "0 24px 70px -22px rgba(20,20,30,0.5)",
              }}
            />
            <span
              style={{
                fontFamily: BRAND,
                fontSize: 112,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: INK,
              }}
            >
              Euclis
            </span>
          </div>
        </PopIn>

        <EntranceUp start={14} style={{ marginTop: 34 }}>
          <p
            style={{
              fontFamily: DISPLAY,
              fontSize: 38,
              fontWeight: 500,
              color: INK_SOFT,
              textAlign: "center",
            }}
          >
            The project brain for teams — and their AI agents.
          </p>
        </EntranceUp>
      </div>
    </AbsoluteFill>
  );
}
