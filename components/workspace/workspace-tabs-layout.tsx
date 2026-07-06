"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  SHELL_CONTENT_MAX,
  type WorkspaceTab,
} from "@/components/layout/app-shell-shared";
import { WorkspaceTabs } from "@/components/workspace/workspace-tabs";
import { WorkspaceToolbarSlotProvider } from "@/components/workspace/workspace-toolbar-slot";

const TAB_LABELS: Record<WorkspaceTab, string> = {
  board: "Overview",
  memory: "Memory",
  links: "Links",
  assets: "Assets",
  whiteboard: "Whiteboard",
  settings: "Settings",
};

function deriveTab(pathname: string): WorkspaceTab {
  if (pathname.endsWith("/memory")) return "memory";
  if (pathname.endsWith("/links")) return "links";
  if (pathname.endsWith("/assets")) return "assets";
  if (pathname.endsWith("/settings")) return "settings";
  if (pathname.endsWith("/whiteboard")) return "whiteboard";
  return "board";
}

/**
 * Persistent workspace chrome: tabs + breadcrumb update instantly from the URL
 * while tab content streams in via Suspense below.
 */
export function WorkspaceTabsLayout({
  workspaceId,
  breadcrumbName,
  title,
  headerActions,
  children,
}: {
  workspaceId: string;
  /** Workspace name for the breadcrumb (streamed from the server layout). */
  breadcrumbName: ReactNode;
  /** Workspace title streamed from the server layout. */
  title: ReactNode;
  /** Invite / member actions streamed from the server layout. */
  headerActions: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = deriveTab(pathname);
  const breadcrumbLeaf = TAB_LABELS[activeTab];
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);

  return (
    <main className={SHELL_CONTENT_MAX}>
      <header className="mb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-ink-faint"
        >
          <Link
            href="/dashboard"
            className="transition hover:text-ink-soft"
          >
            Workspaces
          </Link>
          <span>/</span>
          <Link
            href={`/w/${workspaceId}`}
            className="truncate normal-case transition hover:text-ink-soft"
          >
            {breadcrumbName}
          </Link>
          <span>/</span>
          <span className="truncate text-ink-soft">{breadcrumbLeaf}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          {title}
          {headerActions}
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-line">
          <WorkspaceTabs workspaceId={workspaceId} activeTab={activeTab} />
          <div
            ref={setToolbarSlot}
            className="mb-2 flex flex-wrap items-center justify-end gap-2"
          />
        </div>
      </header>

      <WorkspaceToolbarSlotProvider slot={toolbarSlot}>
        {children}
      </WorkspaceToolbarSlotProvider>
    </main>
  );
}
