"use client";

import Link from "next/link";
import type { WorkspaceTab } from "@/components/layout/app-shell-shared";
import { WORKSPACE_TAB_LINKS } from "@/lib/workspace-nav";
import { ui } from "@/components/ui/ui";

export function WorkspaceTabs({
  workspaceId,
  activeTab,
  className = "",
}: {
  workspaceId: string;
  activeTab: WorkspaceTab;
  className?: string;
}) {
  return (
    <nav
      aria-label="Workspace sections"
      className={`hidden min-w-0 max-w-full flex-wrap items-center gap-x-0.5 gap-y-1 md:flex ${className}`}
    >
      {WORKSPACE_TAB_LINKS.map((tab) => {
        const href = `/w/${workspaceId}${tab.path}`;
        const active = tab.id === activeTab;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`${ui.tabItem} !shrink ${active ? ui.tabItemActive : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
