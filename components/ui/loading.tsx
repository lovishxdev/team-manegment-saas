import {
  SHELL_CONTENT_MAX,
  SHELL_MAIN_X,
  SHELL_TOP,
} from "@/components/layout/app-shell-shared";
import { ui } from "@/components/ui/ui";

function Pulse({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-paper-deep/70 ${className}`}
    />
  );
}

export function Spinner({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-2 border-line border-t-ink/70 ${className}`}
    />
  );
}

export function LoadingCenter({
  label = "Loading…",
  className = "min-h-[8rem]",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <Spinner />
      <p className="text-sm text-ink-faint">{label}</p>
    </div>
  );
}

/** Main content placeholder while a child route streams (shell stays mounted). */
export function MainColumnSkeleton() {
  return (
    <div className={`${SHELL_MAIN_X} pb-10 ${SHELL_TOP}`}>
      <div className="mb-6">
        <Pulse className="h-8 w-48 sm:h-9 sm:w-64" />
        <Pulse className="mt-2 h-4 w-36" />
      </div>
      <Pulse className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function TaskPageSkeleton() {
  return (
    <div className={SHELL_CONTENT_MAX}>
      <Pulse className="h-5 w-16" />
      <Pulse className="mt-4 h-6 w-48" />
      <Pulse className="mt-2 h-9 w-full max-w-xl" />
      <div className="mt-6 flex gap-2">
        <Pulse className="h-9 w-20" />
        <Pulse className="h-9 w-24" />
        <Pulse className="h-9 w-20" />
      </div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <Pulse className="h-10 w-full" />
          <Pulse className="h-40 w-full rounded-xl" />
          <Pulse className="h-32 w-full rounded-xl" />
        </div>
        <Pulse className="h-64 w-full rounded-xl sm:w-56" />
      </div>
    </div>
  );
}

export function ChatBubbleSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl bg-paper-deep/30 px-4 py-3"
        >
          <div className="flex gap-3">
            <Pulse className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Pulse className="h-4 w-24" />
                <Pulse className="h-3 w-28" />
              </div>
              <Pulse className="h-4 w-full max-w-md" />
              <Pulse className="h-4 w-[80%]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MemoryListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <Pulse key={index} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function WhiteboardSkeleton() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-paper px-4">
        <Pulse className="h-4 w-16" />
        <Pulse className="h-4 w-40" />
      </header>
      <div className="flex flex-1 items-center justify-center bg-shell">
        <LoadingCenter label="Loading whiteboard…" className="min-h-0" />
      </div>
    </div>
  );
}

export function InviteCardSkeleton() {
  return (
    <div className={`mx-auto w-full max-w-md space-y-4 p-6 ${ui.contentPanel}`}>
      <Pulse className="mx-auto h-10 w-10 rounded-full" />
      <Pulse className="mx-auto h-6 w-48" />
      <Pulse className="mx-auto h-4 w-64" />
      <Pulse className="mx-auto mt-4 h-10 w-36 rounded-lg" />
    </div>
  );
}
