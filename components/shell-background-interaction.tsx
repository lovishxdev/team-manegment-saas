"use client";

import { useEffect, useRef } from "react";

const LERP = 0.16;
const OFF_SCREEN = -9999;
const TRAIL_GAP = 9;
const MAX_PUFFS = 40;

export function ShellBackgroundInteraction() {
  const trailRef = useRef<HTMLDivElement>(null);
  const splashesRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: OFF_SCREEN, y: OFF_SCREEN });
  const current = useRef({ x: OFF_SCREEN, y: OFF_SCREEN });
  const lastSpawn = useRef({ x: OFF_SCREEN, y: OFF_SCREEN });
  const frame = useRef<number | null>(null);
  const active = useRef(false);
  const puffVariant = useRef(0);

  useEffect(() => {
    const trail = trailRef.current;
    const splashes = splashesRef.current;
    if (!trail || !splashes) return;

    const spawnPuff = (x: number, y: number) => {
      const puff = document.createElement("div");
      puff.className = "shell-trail-puff";
      puff.style.left = `${x}px`;
      puff.style.top = `${y}px`;
      puff.dataset.variant = String(puffVariant.current++ % 3);
      trail.appendChild(puff);

      puff.addEventListener("animationend", () => puff.remove(), { once: true });

      while (trail.childElementCount > MAX_PUFFS) {
        trail.firstElementChild?.remove();
      }
    };

    const tick = () => {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;

      if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        current.current.x += dx * LERP;
        current.current.y += dy * LERP;
      }

      if (active.current && current.current.x !== OFF_SCREEN) {
        const sx = current.current.x;
        const sy = current.current.y;
        const gapX = sx - lastSpawn.current.x;
        const gapY = sy - lastSpawn.current.y;
        const gap = Math.hypot(gapX, gapY);

        if (lastSpawn.current.x === OFF_SCREEN || gap >= TRAIL_GAP) {
          spawnPuff(sx, sy);
          lastSpawn.current = { x: sx, y: sy };
        }
      }

      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);

    const onMove = (event: PointerEvent) => {
      target.current = { x: event.clientX, y: event.clientY };
      if (!active.current) {
        active.current = true;
        current.current = { x: event.clientX, y: event.clientY };
        lastSpawn.current = { x: OFF_SCREEN, y: OFF_SCREEN };
      }
    };

    const onLeave = () => {
      active.current = false;
      target.current = { x: OFF_SCREEN, y: OFF_SCREEN };
      lastSpawn.current = { x: OFF_SCREEN, y: OFF_SCREEN };
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const splash = document.createElement("div");
      splash.className = "shell-splash";
      splash.style.left = `${event.clientX}px`;
      splash.style.top = `${event.clientY}px`;
      splashes.appendChild(splash);

      splash.addEventListener(
        "animationend",
        () => splash.remove(),
        { once: true }
      );
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.body.addEventListener("mouseleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      window.removeEventListener("pointermove", onMove);
      document.body.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <div className="shell-bg-effects" aria-hidden>
      <div ref={trailRef} className="shell-cursor-trail" />
      <div ref={splashesRef} className="shell-splashes" />
    </div>
  );
}
