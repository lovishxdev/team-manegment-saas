"use client";

import { Suspense, type ReactNode } from "react";
import { useSidebar } from "@/components/layout/sidebar-context";
import { SidebarHeader } from "@/components/layout/sidebar-header";
import { SHELL_SIDEBAR_W } from "@/components/layout/app-shell-shared";

/**
 * The sidebar rail. When collapsed it is fully hidden (display:none) — the
 * children stay mounted so realtime subscriptions keep running — and the
 * collapsed logo/toggle live in the content area via `CollapsedTopBar`.
 */
export function SidebarFrame({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <aside
      className={`shell-sidebar sticky top-0 h-screen shrink-0 flex-col overflow-hidden ${
        collapsed ? "hidden" : `hidden ${SHELL_SIDEBAR_W} md:flex`
      }`}
    >
      <SidebarHeader />
      {children}
    </aside>
  );
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
