"use client";

import { useEffect } from "react";

/**
 * Flips the floating nav pill into its "night" theme while the dark Dreaming
 * section sits behind it, then back. Toggles a class on the existing nav so the
 * server-rendered markup stays untouched. Precise: night is on only while the
 * nav's own midline overlaps the section.
 */
export function NavThemeSync() {
  useEffect(() => {
    const pill = document.querySelector<HTMLElement>(".lp-nav-pill");
    const section = document.getElementById("dreaming");
    if (!pill || !section) return;

    let ticking = false;
    const apply = () => {
      ticking = false;
      const r = section.getBoundingClientRect();
      // Approximate the nav's vertical center from the top of the viewport.
      const navMid = pill.getBoundingClientRect().top + pill.offsetHeight / 2;
      const night = r.top <= navMid && r.bottom >= navMid;
      pill.classList.toggle("is-night", night);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      pill.classList.remove("is-night");
    };
  }, []);

  return null;
}
