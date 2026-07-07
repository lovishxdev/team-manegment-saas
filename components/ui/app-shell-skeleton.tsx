import {
  SHELL_MAIN_X,
  SHELL_SIDEBAR_X,
  SHELL_TOP,
} from "@/components/layout/app-shell-shared";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ui } from "@/components/ui/ui";

function Pulse({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-paper-deep/70 ${className}`}
    />
  );
}

export function SidebarNavSkeleton() {
  return (
    <div className={`flex min-h-0 flex-1 flex-col py-3 ${SHELL_SIDEBAR_X}`}>
      <Pulse className="mb-3 h-9 w-full" />
      <div className="flex flex-col gap-1">
        <Pulse className="h-9 w-full" />
        <Pulse className="h-9 w-full" />
      </div>
      <Pulse className="mb-2 mt-4 h-3 w-20" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="mt-auto border-t border-line/60 pt-4">
        <Pulse className="h-10 w-full" />
      </div>
    </div>
  );
}

export function MobileUserSkeleton() {
  return (
    <div className="flex items-center gap-1">
      <div
        aria-hidden
        className="h-7 w-14 animate-pulse rounded-lg bg-paper-deep/70"
      />
      <div
        aria-hidden
        className="h-7 w-7 animate-pulse rounded-full bg-paper-deep/70"
      />
    </div>
  );
}

export function AppShellLoading() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen items-start">
        <aside className="shell-sidebar sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-hidden md:flex lg:w-64">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-line/70 px-3.5">
            <div className="flex items-center gap-2.5">
              <Pulse className="h-8 w-8 shrink-0 rounded-md" />
              <Pulse className="h-5 w-16" />
            </div>
            <Pulse className="h-8 w-8 rounded-lg" />
          </header>
          <SidebarNavSkeleton />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shell-glass flex items-center justify-between border-b border-line/80 px-4 py-2.5 md:hidden">
            <div className="flex items-center gap-2">
              <Pulse className="h-8 w-8 rounded-md" />
              <Pulse className="h-4 w-14" />
            </div>
            <Pulse className="h-7 w-7 rounded-full" />
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className={`${SHELL_MAIN_X} pb-10 ${SHELL_TOP}`}>
              <Pulse className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function DashboardGridSkeleton() {
  return (
    <>
      <div className="mb-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-paper-deep/70 sm:h-9 sm:w-72" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-paper-deep/60" />
        <div className="mt-6 h-11 animate-pulse rounded-lg bg-paper-deep/70" />
      </div>
      <section className={ui.dashboardPanel}>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i}>
              <Pulse className="h-12 rounded-lg" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
