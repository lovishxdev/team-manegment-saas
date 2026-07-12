"use client";

import dynamic from "next/dynamic";

// Client-only: the reel loads webfonts at import time, which must not run
// during SSR.
const Demo2Player = dynamic(
  () => import("@/remotion/demo2/Demo2Player").then((m) => m.Demo2Player),
  { ssr: false },
);

export default function Demo2Page() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0d10] p-[2vh]">
      <div className="aspect-video w-full max-w-[min(100%,177.78vh)]">
        <Demo2Player />
      </div>
    </div>
  );
}
