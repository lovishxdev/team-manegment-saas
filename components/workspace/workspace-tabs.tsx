"use client";

import Link from "next/link";
import type { WorkspaceTab } from "@/components/layout/app-shell-shared";

type TabItem = {
  id: WorkspaceTab;
  label: string;
  path: string;
};

const TABS: TabItem[] = [
  { id: "board", label: "Overview", path: "" },
  { id: "memory", label: "Memory", path: "/memory" },
  { id: "links", label: "Links", path: "/links" },
  { id: "assets", label: "Assets", path: "/assets" },
  { id: "whiteboard", label: "Whiteboard", path: "/whiteboard" },
  { id: "settings", label: "Settings", path: "/settings" },
];

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
      className={`flex flex-wrap items-center gap-1 ${className}`}
    >
      {TABS.map((tab) => {
        const href = `/w/${workspaceId}${tab.path}`;
        const active = tab.id === activeTab;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-ink text-white shadow-sm"
                : "text-ink-soft hover:bg-paper hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
