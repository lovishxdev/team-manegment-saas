"use client";

import Image from "next/image";
import Link from "next/link";
import { ui } from "@/components/ui/ui";

export function ErrorContent({
  reset,
  compact = false,
  digest,
}: {
  /** Retries rendering the segment that threw. */
  reset?: () => void;
  /** When true, fits inside the app shell main column. */
  compact?: boolean;
  /** Next.js error digest, shown subtly for support/debugging. */
  digest?: string;
}) {
  return (
    <main
      className={
        compact
          ? "flex min-h-[min(28rem,60vh)] flex-col items-center justify-center px-4 py-12 text-center"
          : "flex min-h-screen flex-col items-center justify-center px-4 py-16"
      }
    >
      <div className={`w-full text-center ${compact ? "max-w-md" : "max-w-lg"}`}>
        <Link href="/" className="mb-6 inline-block">
          <Image
            src="/euclis-logo.png"
            alt="Euclis"
            width={44}
            height={44}
            className="rounded-lg ring-1 ring-line/80 shadow-sm"
            priority
          />
        </Link>

        <div className={compact ? "" : "content-panel text-left"}>
          <div className={compact ? "" : "px-1 py-1"}>
            <p className="font-mono text-sm font-medium uppercase tracking-wider text-ink-faint">
              Something went wrong
            </p>
            <h1 className={`mt-2 ${compact ? "text-2xl" : ui.workspaceTitle}`}>
              This page hit a snag
            </h1>
            <p className={`${ui.pageSubtitle} ${compact ? "mt-2" : "mt-3"}`}>
              An unexpected error occurred while loading this page. You can try
              again — if it keeps happening, head back and try a different route.
            </p>

            <div
              className={`mt-6 flex flex-wrap items-center gap-2 ${
                compact ? "justify-center" : "justify-center sm:justify-start"
              }`}
            >
              {reset ? (
                <button
                  type="button"
                  onClick={reset}
                  className={ui.btnPrimary}
                >
                  Try again
                </button>
              ) : null}
              <Link href="/dashboard" className={ui.btnSecondary}>
                Go to dashboard
              </Link>
              <Link href="/" className={ui.btnSecondary}>
                Back to home
              </Link>
            </div>

            {digest ? (
              <p className="mt-4 font-mono text-[11px] text-ink-faint">
                Reference: {digest}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
