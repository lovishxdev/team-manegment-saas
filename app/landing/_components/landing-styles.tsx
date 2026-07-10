/**
 * Scoped styles for the /landing route only.
 *
 * Everything is prefixed `lp-` so it can't collide with the rest of the
 * app. Rendered as a plain <style> tag inside the page tree.
 */
export function LandingStyles() {
  return (
    <style>{`
      /* Reserve the scrollbar gutter so the fixed nav (full viewport) and the
         in-flow story section center within the same width — otherwise the hero
         copy sits ~half a scrollbar-width left of the nav logo. */
      html { scrollbar-gutter: stable; }

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
        overflow: hidden;
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

      /* ---------- Scroll story (pinned anchor + swapping copy) ---------- */
      .lp-story {
        position: relative;
      }
      .lp-story-sticky {
        position: sticky;
        top: 0;
        height: 100svh;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-inline: 24px;
        --pin: 0;
        --p: 0;
      }
      /* Match the nav pill's container (header px-6 + max-w-6xl + pill px-5)
         so the hero copy's left edge aligns with the nav logo. */
      .lp-story-wrap {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 3%;
        width: 100%;
        max-width: 1152px;
        margin-inline: auto;
        padding-inline: 20px;
        height: 100%;
      }
      .lp-story-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
          radial-gradient(ellipse 45% 55% at 8% 6%, rgba(255, 220, 150, 0.18) 0%, transparent 55%),
          radial-gradient(ellipse 45% 55% at 94% 10%, rgba(255, 200, 214, 0.14) 0%, transparent 55%),
          #fbfaf9;
      }

      .lp-story-anchor {
        position: relative;
        z-index: 1;
        width: 62%;
        transform-style: preserve-3d;
        transform-origin: right center;
        transform:
          perspective(1800px)
          translateX(calc((1 - var(--pin)) * 5%))
          scale(calc(0.94 + 0.06 * var(--pin)))
          rotateY(calc((1 - var(--pin)) * -12deg))
          rotateZ(calc((1 - var(--pin)) * -1.2deg));
        will-change: transform;
      }

      .lp-story-copy {
        position: relative;
        z-index: 2;
        width: 35%;
        height: 66svh;
        pointer-events: none;
      }
      .lp-story-panel {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        opacity: 0;
        transform: translate3d(0, 16px, 0);
        transition:
          opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .lp-story-panel.is-active {
        opacity: 1;
        transform: translate3d(0, 0, 0);
        pointer-events: auto;
      }

      .lp-story-dots {
        position: absolute;
        left: 50%;
        bottom: 26px;
        z-index: 3;
        transform: translateX(-50%);
        display: flex;
        gap: 7px;
      }
      .lp-story-dots span {
        width: 6px;
        height: 6px;
        border-radius: 9999px;
        background: rgba(26, 26, 26, 0.18);
        transition: background 0.3s ease, width 0.3s ease;
      }
      .lp-story-dots span.is-active {
        width: 20px;
        background: rgba(26, 26, 26, 0.7);
      }

      /* Idle "breathing" float — only in the hero so reading chapters stay calm */
      .lp-wms[data-chapter="0"] {
        animation: lp-wms-breathe 9s ease-in-out infinite;
      }
      @keyframes lp-wms-breathe {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50%      { transform: translate3d(0, -6px, 0); }
      }

      /* Typing indicator — the discussion feels live and ongoing */
      .lp-typing {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 9px 12px;
        border-radius: 12px;
        border-top-left-radius: 4px;
        background: var(--color-paper-deep, rgba(0, 0, 0, 0.05));
      }
      .lp-typing i {
        width: 6px;
        height: 6px;
        border-radius: 9999px;
        background: var(--color-ink-soft, #6b6b6b);
        opacity: 0.4;
        animation: lp-typing 1.3s ease-in-out infinite;
      }
      .lp-typing i:nth-child(2) { animation-delay: 0.18s; }
      .lp-typing i:nth-child(3) { animation-delay: 0.36s; }
      @keyframes lp-typing {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
        30%           { transform: translateY(-4px); opacity: 0.9; }
      }

      /* Empty memory panel — a soft scan beam + pulsing radar so it feels like
         it's actively listening for something to capture. */
      .lp-mem-empty {
        position: relative;
        overflow: hidden;
      }
      .lp-mem-empty::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        height: 45%;
        top: -45%;
        background: linear-gradient(180deg, transparent, rgba(120, 120, 150, 0.07), transparent);
        animation: lp-mem-scan 3.4s ease-in-out infinite;
      }
      @keyframes lp-mem-scan {
        0%   { top: -45%; }
        100% { top: 100%; }
      }
      .lp-mem-radar {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 10px;
        height: 10px;
        margin: -5px 0 0 -5px;
        border-radius: 9999px;
        background: rgba(120, 120, 150, 0.35);
        transform: translateY(-46px);
      }
      .lp-mem-radar::before,
      .lp-mem-radar::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        border: 1px solid rgba(120, 120, 150, 0.35);
        animation: lp-mem-ping 2.6s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      .lp-mem-radar::after { animation-delay: 1.3s; }
      @keyframes lp-mem-ping {
        0%   { transform: scale(1);   opacity: 0.6; }
        80%, 100% { transform: scale(3.4); opacity: 0; }
      }

      /* Anchor content transitions (feed + memory fill in) */
      .lp-wms-in {
        animation: lp-wms-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes lp-wms-in {
        from { opacity: 0; transform: translate3d(0, 8px, 0); }
        to   { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      .lp-wms-live {
        position: relative;
      }
      .lp-wms-live::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: #10b981;
        animation: lp-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        opacity: 0.5;
      }
      @media (prefers-reduced-motion: reduce) {
        .lp-story-anchor { transform: none; }
        .lp-story-panel { transition: none; }
        .lp-wms-in { animation: none; }
        .lp-wms[data-chapter="0"] { animation: none; }
        .lp-typing i { animation: none; }
        .lp-mem-empty::after,
        .lp-mem-radar::before,
        .lp-mem-radar::after { animation: none; }
      }

      /* ---------- Capture beat: sources peek out from behind the frame ---------- */
      /* The frame sits above the cloud, so boxes tucked toward center are hidden
         behind it, then slide outward to peek at the edges when active. */
      .lp-story-anchor > .lp-wms {
        position: relative;
        z-index: 2;
      }
      .lp-src-cloud {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
      }
      .lp-src-pill {
        position: absolute;
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.97);
        border: 1px solid rgba(0, 0, 0, 0.07);
        box-shadow: 0 16px 40px -16px rgba(20, 20, 30, 0.34);
        color: var(--color-ink);
        /* Pure slide, no fade — boxes hide behind the frame's opaque background.
           Symmetric ease-in-out so entry and exit read as the same motion
           reversed (slow near the edge where they're actually visible). */
        transition: transform 0.6s cubic-bezier(0.6, 0, 0.4, 1);
      }
      /* Resting (behind the frame): tucked toward center, hidden.
         Positions are intentionally staggered (not symmetric) for a natural,
         scattered feel — fixed values, not randomized per load. */
      /* Resting (hidden): tucked just behind the frame edge — short travel so
         most of the slide is visible in the gap, and exit is staggered to
         mirror the entry. */
      .pos-1 { top: 7%;  left: -40px; transform: translate3d(96px, 0, 0) scale(0.72); transition-delay: 0.27s; }
      .pos-2 { top: 19%; right: -32px; transform: translate3d(-96px, 0, 0) scale(0.72); transition-delay: 0.18s; }
      .pos-3 { bottom: 2%; right: -44px; transform: translate3d(-96px, 0, 0) scale(0.72); transition-delay: 0.09s; }
      .pos-4 { bottom: 25%; left: -34px; transform: translate3d(96px, 0, 0) scale(0.72); transition-delay: 0s; }
      /* Peeked out (active): slide to edge positions, each with a slight tilt. */
      .lp-src-cloud.is-on .pos-1 { transform: translate3d(0, 0, 0) rotate(-5deg); }
      .lp-src-cloud.is-on .pos-2 { transform: translate3d(0, 0, 0) rotate(4deg); }
      .lp-src-cloud.is-on .pos-3 { transform: translate3d(0, 0, 0) rotate(-3deg); }
      .lp-src-cloud.is-on .pos-4 { transform: translate3d(0, 0, 0) rotate(6deg); }
      .lp-src-cloud.is-on .pos-1 { transition-delay: 0.04s; }
      .lp-src-cloud.is-on .pos-2 { transition-delay: 0.13s; }
      .lp-src-cloud.is-on .pos-3 { transition-delay: 0.22s; }
      .lp-src-cloud.is-on .pos-4 { transition-delay: 0.31s; }

      /* Hero peek-a-boo: boxes poke out from behind the frame then duck back,
         each on a staggered delay so it feels like playful mischief. */
      .lp-src-cloud.is-hero .pos-1 { animation: lp-mischief-l 6.5s ease-in-out infinite; animation-delay: 0.2s; }
      .lp-src-cloud.is-hero .pos-2 { animation: lp-mischief-r 6.5s ease-in-out infinite; animation-delay: 1.7s; }
      .lp-src-cloud.is-hero .pos-3 { animation: lp-mischief-r 6.5s ease-in-out infinite; animation-delay: 3.6s; }
      .lp-src-cloud.is-hero .pos-4 { animation: lp-mischief-l 6.5s ease-in-out infinite; animation-delay: 4.9s; }
      @keyframes lp-mischief-l {
        0%, 14%   { transform: translate3d(96px, 0, 0) scale(0.7); opacity: 0; }
        24%       { transform: translate3d(-4px, -2px, 0) rotate(-7deg) scale(1); opacity: 1; }
        31%       { transform: translate3d(6px, 1px, 0) rotate(-3deg) scale(1); opacity: 1; }
        42%, 100% { transform: translate3d(96px, 0, 0) scale(0.7); opacity: 0; }
      }
      @keyframes lp-mischief-r {
        0%, 14%   { transform: translate3d(-96px, 0, 0) scale(0.7); opacity: 0; }
        24%       { transform: translate3d(4px, -2px, 0) rotate(7deg) scale(1); opacity: 1; }
        31%       { transform: translate3d(-6px, 1px, 0) rotate(3deg) scale(1); opacity: 1; }
        42%, 100% { transform: translate3d(-96px, 0, 0) scale(0.7); opacity: 0; }
      }

      /* ---------- Shared beat: agent cameo reading memory ---------- */
      .lp-agent-cameo {
        position: absolute;
        right: -18px;
        bottom: 24%;
        z-index: 7;
        width: 208px;
        padding: 11px 13px;
        border-radius: 13px;
        background: rgba(255, 255, 255, 0.98);
        border: 1px solid rgba(0, 0, 0, 0.07);
        box-shadow: 0 28px 64px -26px rgba(20, 20, 30, 0.4);
        pointer-events: none;
        opacity: 0;
        transform: translate3d(26px, 0, 0);
        transition:
          opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
          transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .lp-agent-cameo.is-on {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
      .lp-agent-cameo-head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--color-ink);
      }
      .lp-agent-call {
        display: block;
        margin-top: 9px;
        padding: 6px 8px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.04);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10.5px;
        color: var(--color-ink-soft);
      }
      .lp-agent-res {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 7px;
        font-size: 10px;
        font-weight: 600;
        color: #0f7a63;
      }
      .lp-agent-check {
        display: inline-grid;
        place-items: center;
        width: 13px;
        height: 13px;
        border-radius: 9999px;
        background: #10b981;
        color: #fff;
        font-size: 8px;
      }
      @media (prefers-reduced-motion: reduce) {
        .lp-src-pill,
        .lp-agent-cameo { transition: none; }
        .lp-src-cloud.is-hero .lp-src-pill { animation: none; }
      }
    `}</style>
  );
}
