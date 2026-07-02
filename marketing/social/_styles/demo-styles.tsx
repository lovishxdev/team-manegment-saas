/**
 * Scoped styles for social recording demos only (`/marketing/*`).
 * Prefixed `mkt-` — not used on the public landing page.
 */
export function MarketingDemoStyles() {
  return (
    <style>{`
      .mkt-wa-header {
        background-color: #128c7e;
      }

      .mkt-caret {
        display: inline-block;
        width: 1px;
        height: 1em;
        background: currentColor;
        margin-left: 2px;
        vertical-align: middle;
        animation: mkt-blink 1.05s steps(2, start) infinite;
      }
      @keyframes mkt-blink {
        50% { opacity: 0; }
      }

      .mkt-bubble {
        animation: mkt-bubble-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes mkt-bubble-in {
        from { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.96); }
        to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      }

      .mkt-card-pop {
        animation: mkt-card-slide 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes mkt-card-slide {
        from { opacity: 0; transform: translate3d(-14px, 8px, 0) scale(0.96); }
        to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      }

      .mkt-pulse-dot::before,
      .mkt-pulse-dot::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 9999px;
        background: #f97316;
      }
      .mkt-pulse-dot::after {
        animation: mkt-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        opacity: 0.55;
      }
      @keyframes mkt-ping {
        0%   { transform: scale(1); opacity: 0.55; }
        80%  { transform: scale(2.6); opacity: 0; }
        100% { transform: scale(2.6); opacity: 0; }
      }

      .mkt-tool-pop {
        animation: mkt-tool-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes mkt-tool-in {
        from { opacity: 0; transform: translate3d(0, 10px, 0); }
        to   { opacity: 1; transform: translate3d(0, 0, 0); }
      }

      .mkt-caption {
        animation: mkt-caption-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes mkt-caption-in {
        from { opacity: 0; transform: translate3d(0, 12px, 0); }
        to   { opacity: 1; transform: translate3d(0, 0, 0); }
      }

      .mkt-bg-mesh {
        background:
          radial-gradient(ellipse 70% 60% at 15% 20%, rgba(255, 218, 130, 0.45) 0%, transparent 65%),
          radial-gradient(ellipse 60% 55% at 85% 25%, rgba(195, 188, 255, 0.4) 0%, transparent 65%),
          radial-gradient(ellipse 55% 50% at 50% 100%, rgba(255, 185, 205, 0.35) 0%, transparent 70%),
          linear-gradient(135deg, #fafafa 0%, #f0ebe3 45%, #e8e4f8 100%);
      }

      .mkt-scene-fade {
        transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1);
      }

      @media (prefers-reduced-motion: reduce) {
        .mkt-bubble,
        .mkt-card-pop,
        .mkt-tool-pop,
        .mkt-caption { animation: none; }
        .mkt-scene-fade { transition: none; }
      }

      html.mkt-recording,
      html.mkt-recording body {
        overflow: hidden;
        height: 100%;
      }
    `}</style>
  );
}
