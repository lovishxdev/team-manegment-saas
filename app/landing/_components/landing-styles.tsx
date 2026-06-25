/**
 * Scoped styles for the /landing route only.
 *
 * Everything is prefixed `lp-` so it can't collide with the rest of the
 * app. Rendered as a plain <style> tag inside the page tree.
 */
export function LandingStyles() {
  return (
    <style>{`
      /* ---------- Floating pill nav ---------- */
      .lp-nav-pill {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 8px 28px -10px rgba(20, 20, 30, 0.14);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        transform: translateZ(0);
      }
      .lp-nav-link {
        display: inline-flex;
        align-items: center;
        border-radius: 0.5rem;
        padding: 0.45rem 0.85rem;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.25;
        color: var(--color-ink-soft);
        transition: color 0.2s ease, background-color 0.2s ease;
      }
      .lp-nav-link:hover {
        color: var(--color-ink);
        background: rgba(255, 255, 255, 0.55);
      }

      /* ---------- Hero / full-bleed photo ---------- */
      .lp-hero {
        position: relative;
        isolation: isolate;
        min-height: 100svh;
        overflow: hidden;
      }

      .lp-hero-photo {
        position: absolute;
        inset: 0;
        z-index: -3;
        background-size: cover;
        background-position: center center;
        transform: scale(1.04);
        animation: lp-hero-pan 38s ease-in-out infinite alternate;
        will-change: transform;
      }

      @keyframes lp-hero-pan {
        0%   { transform: scale(1.04) translate3d(0, 0, 0); }
        100% { transform: scale(1.08) translate3d(-1.5%, -1%, 0); }
      }

      /* Soft wash so headline text stays readable over the illustration */
      .lp-hero-wash {
        position: absolute;
        inset: 0;
        z-index: -2;
        pointer-events: none;
        background:
          radial-gradient(ellipse 90% 70% at 50% 35%, rgba(255, 255, 255, 0.72) 0%, transparent 70%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 45%, rgba(239, 239, 239, 0.0) 62%, rgba(239, 239, 239, 0.5) 88%, #efefef 100%);
      }

      /* Subtle film grain to keep the photo from looking flat against UI */
      .lp-grain::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.05;
        mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>");
      }

      /* Floating geometric ornaments (echo the Euclis geometry brand) */
      .lp-float-slow {
        animation: lp-float-slow 9s ease-in-out infinite;
      }
      .lp-float-slower {
        animation: lp-float-slow 14s ease-in-out infinite;
      }
      @keyframes lp-float-slow {
        0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        50%      { transform: translate3d(0, -14px, 0) rotate(8deg); }
      }

      /* ---------- Scroll-reveal ---------- */
      .lp-reveal {
        opacity: 0;
        transform: translate3d(0, 24px, 0);
        transition:
          opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
        transition-delay: var(--lp-reveal-delay, 0ms);
      }
      .lp-reveal.is-in {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
      @media (prefers-reduced-motion: reduce) {
        .lp-reveal { opacity: 1; transform: none; transition: none; }
        .lp-hero-photo { animation: none; }
      }

      /* ---------- Rotating words ---------- */
      .lp-rotator {
        display: inline-block;
        position: relative;
        vertical-align: baseline;
        line-height: 1.1;
        text-align: center;
      }
      .lp-rotator-sizer {
        visibility: hidden;
        display: block;
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
        line-height: 1.1;
      }
      .lp-rotator-clip {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }
      .lp-rotator-word {
        position: absolute;
        left: 50%;
        top: 0;
        white-space: nowrap;
        line-height: 1.1;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        transition:
          opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.6s cubic-bezier(0.22, 1, 0.36, 1),
          visibility 0s linear 0.6s;
      }
      .lp-rotator-word.is-active,
      .lp-rotator-word.is-prev {
        transition:
          opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.6s cubic-bezier(0.22, 1, 0.36, 1),
          visibility 0s linear 0s;
      }

      /* ---------- Marquee ---------- */
      .lp-marquee {
        display: flex;
        overflow: hidden;
        mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
      }
      .lp-marquee-track {
        display: flex;
        gap: 2.5rem;
        flex-shrink: 0;
        width: max-content;
        animation: lp-marquee 76s linear infinite;
      }
      @keyframes lp-marquee {
        from { transform: translate3d(0, 0, 0); }
        to   { transform: translate3d(-50%, 0, 0); }
      }

      /* ---------- Live pulse dot ---------- */
      .lp-pulse {
        position: relative;
        display: inline-flex;
        width: 8px;
        height: 8px;
      }
      .lp-pulse::before,
      .lp-pulse::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: #f97316;
      }
      .lp-pulse::after {
        animation: lp-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        opacity: 0.55;
      }
      @keyframes lp-ping {
        0%   { transform: scale(1);   opacity: 0.55; }
        80%  { transform: scale(2.6); opacity: 0;    }
        100% { transform: scale(2.6); opacity: 0;    }
      }

      /* ---------- Typing cursor ---------- */
      .lp-caret {
        display: inline-block;
        width: 1px;
        height: 1em;
        background: currentColor;
        margin-left: 2px;
        vertical-align: middle;
        animation: lp-blink 1.05s steps(2, start) infinite;
      }
      @keyframes lp-blink {
        50% { opacity: 0; }
      }

      /* ---------- Chat bubble pop ---------- */
      @keyframes lp-bubble-in {
        from { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.96); }
        to   { opacity: 1; transform: translate3d(0, 0, 0)   scale(1);    }
      }
      .lp-bubble {
        animation: lp-bubble-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* ---------- Task card slide-in (kanban demo) ---------- */
      @keyframes lp-card-slide {
        from { opacity: 0; transform: translate3d(-12px, 6px, 0); }
        to   { opacity: 1; transform: translate3d(0, 0, 0);       }
      }
      .lp-card-pop {
        animation: lp-card-slide 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* ---------- Scroll cue ---------- */
      .lp-scroll-cue {
        animation: lp-scroll-bounce 2.2s ease-in-out infinite;
      }
      @keyframes lp-scroll-bounce {
        0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.55; }
        50%      { transform: translate3d(0, 6px, 0); opacity: 1; }
      }

      /* ---------- Use-case tiles hover lift ---------- */
      .lp-tile {
        transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                    box-shadow 0.4s ease,
                    border-color 0.3s ease;
      }
      .lp-tile:hover {
        transform: translate3d(0, -4px, 0);
        box-shadow: 0 24px 60px -28px rgba(20, 20, 30, 0.18);
      }

      /* ---------- Section dividers (geometry-line) ---------- */
      .lp-line {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.10), transparent);
      }

      /* ---------- Animated mesh under stats / cta ---------- */
      .lp-mesh {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(ellipse 60% 90% at 12% 18%, rgba(255, 218, 130, 0.55) 0%, transparent 65%),
          radial-gradient(ellipse 60% 80% at 88% 30%, rgba(255, 185, 205, 0.55) 0%, transparent 65%),
          radial-gradient(ellipse 50% 75% at 50% 105%, rgba(195, 188, 255, 0.55) 0%, transparent 70%),
          radial-gradient(ellipse 45% 55% at 72% 88%, rgba(255, 200, 170, 0.45) 0%, transparent 65%);
        animation: lp-mesh-drift 22s ease-in-out infinite alternate;
      }
      @keyframes lp-mesh-drift {
        0%   { transform: scale(1) translate3d(0, 0, 0); }
        100% { transform: scale(1.08) translate3d(-1.5%, 1%, 0); }
      }

      /* ---------- Subtle CTA shimmer ---------- */
      .lp-shimmer {
        position: relative;
        overflow: hidden;
      }
      .lp-shimmer::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%);
        transform: translateX(-100%);
        transition: transform 0.9s ease;
      }
      .lp-shimmer:hover::after {
        transform: translateX(100%);
      }

      /* ---------- WhatsApp brand chip ---------- */
      .lp-wa-gradient {
        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
      }

      /* ---------- Dashboard preview — view crossfade + whiteboard ---------- */
      .lp-preview-pane {
        transition: opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .lp-preview-pane.is-hidden {
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
      }
      .lp-wb-grid {
        background-color: #ffffff;
        background-image: radial-gradient(#d6d6d6 0.85px, transparent 0.85px);
        background-size: 14px 14px;
      }
      .lp-wb-stroke-draw {
        stroke-dasharray: 120;
        stroke-dashoffset: 120;
        animation: lp-wb-draw 4.5s ease-in-out infinite;
      }
      @keyframes lp-wb-draw {
        0%, 12%   { stroke-dashoffset: 120; opacity: 0.35; }
        45%, 78%  { stroke-dashoffset: 0;   opacity: 1; }
        100%      { stroke-dashoffset: 0;   opacity: 0.85; }
      }
      .lp-wb-cursor-a,
      .lp-wb-cursor-b,
      .lp-wb-cursor-c,
      .lp-wb-cursor-d {
        will-change: transform;
      }
      .lp-wb-cursor-a {
        left: 11%;
        top: 21%;
        animation: lp-wb-cursor-a 6.5s ease-in-out infinite;
      }
      .lp-wb-cursor-b {
        left: 56%;
        top: 16%;
        animation: lp-wb-cursor-b 7.2s ease-in-out infinite;
      }
      .lp-wb-cursor-c {
        left: 14%;
        top: 63%;
        animation: lp-wb-cursor-c 5.8s ease-in-out infinite;
      }
      .lp-wb-cursor-d {
        left: 70%;
        top: 58%;
        animation: lp-wb-cursor-d 6.8s ease-in-out infinite;
      }
      @keyframes lp-wb-cursor-a {
        0%, 100% { transform: translate(0, 0); }
        35%      { transform: translate(28px, 18px); }
        68%      { transform: translate(12px, 32px); }
      }
      @keyframes lp-wb-cursor-b {
        0%, 100% { transform: translate(0, 0); }
        40%      { transform: translate(-22px, 24px); }
        72%      { transform: translate(16px, 10px); }
      }
      @keyframes lp-wb-cursor-c {
        0%, 100% { transform: translate(0, 0); }
        45%      { transform: translate(24px, -14px); }
        75%      { transform: translate(8px, 18px); }
      }
      @keyframes lp-wb-cursor-d {
        0%, 100% { transform: translate(0, 0); }
        38%      { transform: translate(-18px, 20px); }
        70%      { transform: translate(14px, -12px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .lp-preview-pane { transition: none; }
        .lp-wb-stroke-draw,
        .lp-wb-cursor-a,
        .lp-wb-cursor-b,
        .lp-wb-cursor-c,
        .lp-wb-cursor-d { animation: none; }
      }
    `}</style>
  );
}
