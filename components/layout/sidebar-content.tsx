"use client";

import { type ReactNode } from "react";
import { useSidebar } from "@/components/layout/sidebar-context";
import { SHELL_SIDEBAR_X } from "@/components/layout/app-shell-shared";

/**
 * When collapsed, the rail shows only the header (logo + expand toggle) —
 * Tracky-style. Nav and account are hidden entirely.
 */
export function SidebarContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  if (collapsed) return null;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden py-3 ${SHELL_SIDEBAR_X}`}
    >
      {children}
    </div>
  );
}
