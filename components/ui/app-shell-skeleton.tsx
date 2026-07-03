import {
  SHELL_BRAND_ROW,
  SHELL_MAIN_X,
  SHELL_SIDEBAR_X,
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

export function SidebarNavSkeleton() {
  return (
    <div className={`mt-8 flex min-h-0 flex-1 flex-col ${SHELL_SIDEBAR_X}`}>
      <div className="flex flex-col gap-1">
        <Pulse className="mb-2 h-3 w-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="mt-auto pt-6">
        <Pulse className="h-10 w-full" />
      </div>
    </div>
  );
}

export function AppShellLoading() {
  return (
    <div className="flex min-h-screen items-start">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-hidden pb-6 md:flex lg:w-64">
        <header className={`${SHELL_SIDEBAR_X} ${SHELL_TOP}`}>
          <div className={`${SHELL_BRAND_ROW} gap-2.5 px-2`}>
            <Pulse className="h-[39px] w-[39px] shrink-0 rounded-md" />
            <Pulse className="h-6 w-20" />
          </div>
        </header>
        <SidebarNavSkeleton />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Pulse className="h-[34px] w-[34px] rounded-md" />
            <Pulse className="h-4 w-14" />
          </div>
          <Pulse className="h-7 w-7 rounded-full" />
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className={`${SHELL_MAIN_X} pb-8 ${SHELL_TOP}`}>
            <div className={SHELL_BRAND_ROW}>
              <Pulse className="h-8 w-48" />
            </div>
            <Pulse className="mt-6 h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardGridSkeleton() {
  return (
    <section className={ui.dashboardPanel}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
