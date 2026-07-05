"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SHELL_BRAND_ROW, type WorkspaceTab } from "@/components/layout/app-shell-shared";
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

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5 shrink-0 text-ink-faint"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <path
        d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3.2l1.3 1.5H13a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Persistent workspace chrome: tabs + breadcrumb update instantly from the URL
 * while tab content streams in via Suspense below.
 */
export function WorkspaceTabsLayout({
  workspaceId,
  title,
  headerActions,
  children,
}: {
  workspaceId: string;
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
    <main className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <div className={`${SHELL_BRAND_ROW} justify-between gap-4`}>
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-sm leading-none text-ink-soft"
          >
            <FolderIcon />
            <Link href="/dashboard" className="transition hover:text-ink">
              Workspaces
            </Link>
            <span className="text-ink-faint">›</span>
            <Link
              href={`/w/${workspaceId}`}
              className="truncate transition hover:text-ink"
            >
              Workspace
            </Link>
            <span className="text-ink-faint">›</span>
            <span className="truncate text-ink">{breadcrumbLeaf}</span>
          </nav>
          {headerActions}
        </div>

        {title}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <WorkspaceTabs workspaceId={workspaceId} activeTab={activeTab} />
          <div
            ref={setToolbarSlot}
            className="flex flex-wrap items-center justify-end gap-2"
          />
        </div>
      </header>

      <WorkspaceToolbarSlotProvider slot={toolbarSlot}>
        {children}
      </WorkspaceToolbarSlotProvider>
    </main>
  );
}
