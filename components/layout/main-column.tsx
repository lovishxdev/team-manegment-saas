"use client";

import { type ReactNode } from "react";
import { useSidebar } from "@/components/layout/sidebar-context";
import { CollapsedTopBar } from "@/components/layout/sidebar-header";
import { SHELL_MAIN_X, SHELL_TOP } from "@/components/layout/app-shell-shared";

/** Main scroll column — full width when the sidebar is collapsed. */
export function MainColumn({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <CollapsedTopBar />

      <div className={`flex-1 overflow-y-auto ${collapsed ? "" : SHELL_TOP}`}>
        <div
          className={`${SHELL_MAIN_X} pb-10 ${collapsed ? "pt-4 sm:pt-5" : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
