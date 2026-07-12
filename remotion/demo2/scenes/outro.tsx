"use client";

import { AbsoluteFill, Img, staticFile } from "remotion";
import { SCENE_FRAMES } from "../constants";
import { DISPLAY, EntranceUp, INK, INK_SOFT, PopIn, useSceneFade } from "../ui";

export function OutroScene() {
  const opacity = useSceneFade(SCENE_FRAMES.outro);

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <PopIn start={2}>
          <Img
            src={staticFile("euclis-logo.png")}
            style={{ width: 96, height: 96, borderRadius: 24, boxShadow: "0 20px 56px -20px rgba(20,20,30,0.5)" }}
          />
        </PopIn>

        <EntranceUp start={12} style={{ marginTop: 34, maxWidth: 1320 }}>
          <h1
            style={{
              fontFamily: DISPLAY,
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
              color: INK,
            }}
          >
            The project brain for your team{" "}
            <span style={{ fontStyle: "italic", color: INK_SOFT }}>
              — and your AI agents.
            </span>
          </h1>
        </EntranceUp>

        <EntranceUp start={28} style={{ marginTop: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <span
              style={{
                fontFamily: DISPLAY,
                borderRadius: 999,
                background: INK,
                color: "#fff",
                padding: "20px 46px",
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              Free to use · euclis.dev
            </span>
            <span style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 500, color: INK_SOFT }}>
              Captures every decision. Cuts the busywork.
            </span>
          </div>
        </EntranceUp>
      </div>
    </AbsoluteFill>
  );
}
