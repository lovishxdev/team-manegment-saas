import Image from "next/image";
import Link from "next/link";
import { ui } from "@/components/ui/ui";

export function NotFoundContent({
  compact = false,
}: {
  /** When true, fits inside the app shell main column. */
  compact?: boolean;
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
              Error 404
            </p>
            <h1 className={`mt-2 ${compact ? "text-2xl" : ui.workspaceTitle}`}>
              Page not found
            </h1>
            <p className={`${ui.pageSubtitle} ${compact ? "mt-2" : "mt-3"}`}>
              This link may be broken, or the page may have been moved or
              deleted.
            </p>

            <div
              className={`mt-6 flex flex-wrap items-center gap-2 ${
                compact ? "justify-center" : "justify-center sm:justify-start"
              }`}
            >
              <Link href="/dashboard" className={ui.btnPrimary}>
                Go to dashboard
              </Link>
              <Link href="/" className={ui.btnSecondary}>
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
