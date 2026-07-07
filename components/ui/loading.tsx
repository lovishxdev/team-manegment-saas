import {
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

export function ChatBubbleSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex gap-2.5">
          <Pulse className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-14 w-full rounded-2xl rounded-tl-md" />
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
