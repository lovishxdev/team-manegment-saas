import Link from "next/link";

export default function MarketingIndexPage() {
  return (
    <div className="min-h-screen bg-[#111] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/50">
          Local / recording only
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Euclis social demos
        </h1>
        <p className="mt-3 text-white/70">
          Full-screen animations for Reddit and social posts. Not linked from the
          public site. Blocked in production unless{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
            ENABLE_MARKETING_DEMOS=true
          </code>
          .
        </p>

        <ul className="mt-10 space-y-4">
          <li>
            <Link
              href="/demo1"
              className="block rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 transition hover:bg-emerald-500/15"
            >
              <span className="text-lg font-medium">★ Full demo reel (~32s)</span>
              <p className="mt-1 text-sm text-white/60">
                Intro → WhatsApp → Claude → web dashboard → outro (loops)
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/marketing/whatsapp"
              className="block rounded-xl border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10"
            >
              <span className="text-lg font-medium">WhatsApp → kanban sync</span>
              <p className="mt-1 text-sm text-white/60">
                1:1 bot demo with hook captions for r/SideProject
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/marketing/claude"
              className="block rounded-xl border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10"
            >
              <span className="text-lg font-medium">Claude MCP → board</span>
              <p className="mt-1 text-sm text-white/60">
                Tool calls create tasks on the shared workspace
              </p>
            </Link>
          </li>
        </ul>

        <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          <p className="font-medium text-white">How to record</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Open a demo link below in a maximized window.</li>
            <li>Full-screen the browser tab (⌃⌘F on Mac, F11 on Windows).</li>
            <li>Window-record with QuickTime or OBS — the demo fills the screen.</li>
            <li>Export MP4 → upload natively to Reddit.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
