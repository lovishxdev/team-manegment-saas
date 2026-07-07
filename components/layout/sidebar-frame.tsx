"use client";

import { Suspense, type ReactNode } from "react";
import { useSidebar } from "@/components/layout/sidebar-context";
import { SidebarHeader } from "@/components/layout/sidebar-header";
import { SHELL_SIDEBAR_W } from "@/components/layout/app-shell-shared";

function SidebarPanel({ children }: { children: ReactNode }) {
  const { collapsed, mobileOpen, closeMobile } = useSidebar();

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] md:hidden"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={`shell-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col overflow-hidden bg-paper transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:h-screen md:w-auto md:translate-x-0 md:bg-transparent md:shadow-none ${
          mobileOpen ? "translate-x-0 shadow-[4px_0_24px_rgba(26,26,26,0.12)]" : "-translate-x-full md:translate-x-0"
        } ${
          collapsed
            ? "md:hidden"
            : `md:flex ${SHELL_SIDEBAR_W}`
        }`}
      >
        <SidebarHeader />
        {children}
      </aside>
    </>
  );
}

/**
 * The sidebar rail. On mobile it is an off-canvas drawer; on desktop it stays
 * beside the main column (hidden entirely when collapsed).
 */
export function SidebarFrame({ children }: { children: ReactNode }) {
  return <SidebarPanel>{children}</SidebarPanel>;
}

export function SidebarFrameWithSuspense({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarFrame>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SidebarFrame>
  );
}
