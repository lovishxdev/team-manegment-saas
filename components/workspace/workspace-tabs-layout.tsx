"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  SHELL_CONTENT_MAX,
} from "@/components/layout/app-shell-shared";
import { WorkspaceTabs } from "@/components/workspace/workspace-tabs";
import { WorkspaceToolbarSlotProvider } from "@/components/workspace/workspace-toolbar-slot";
import { ui } from "@/components/ui/ui";
import {
  WORKSPACE_TAB_LINKS,
  workspaceTabFromPathname,
} from "@/lib/workspace-nav";

const TAB_LABELS = Object.fromEntries(
  WORKSPACE_TAB_LINKS.map((tab) => [tab.id, tab.label])
) as Record<(typeof WORKSPACE_TAB_LINKS)[number]["id"], string>;

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
  const activeTab = workspaceTabFromPathname(pathname);
  const breadcrumbLeaf = TAB_LABELS[activeTab];
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);

  return (
    <main className={`${SHELL_CONTENT_MAX} min-w-0 overflow-x-hidden`}>
      <header className="mb-6">
        <nav aria-label="Breadcrumb" className={ui.breadcrumbNav}>
          <Link href="/dashboard" className={ui.breadcrumbLink}>
            Workspaces
          </Link>
          <span>/</span>
          <Link
            href={`/w/${workspaceId}`}
            className={`${ui.breadcrumbLink} truncate normal-case`}
          >
            {breadcrumbName}
          </Link>
          <span>/</span>
          <span className={ui.breadcrumbCurrent}>{breadcrumbLeaf}</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          {title}
          {headerActions}
        </div>

        <div className="mt-6 min-w-0 md:border-b md:border-line">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <WorkspaceTabs
              workspaceId={workspaceId}
              activeTab={activeTab}
              className="lg:flex-1"
            />
            <div
              ref={setToolbarSlot}
              className="mb-2 flex min-w-0 flex-wrap items-center justify-start gap-2 lg:mb-2 lg:shrink-0 lg:justify-end"
            />
          </div>
        </div>
      </header>

      <WorkspaceToolbarSlotProvider slot={toolbarSlot}>
        {children}
      </WorkspaceToolbarSlotProvider>
    </main>
  );
}
