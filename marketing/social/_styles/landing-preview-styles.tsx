/**
 * Dashboard preview animations from the landing page (`DashboardPreview`).
 * Included on `/demo1` and other recording routes — not the public homepage.
 */
export function LandingPreviewStyles() {
  return (
    <style>{`
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
