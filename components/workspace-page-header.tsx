import type { ReactNode } from "react";
import Link from "next/link";
import {
  SHELL_BRAND_ROW,
  type WorkspaceTab,
} from "@/components/app-shell-shared";
import {
  WorkspaceHeaderActions,
  type HeaderMember,
} from "@/components/workspace-header-actions";
import { WorkspaceTabs } from "@/components/workspace-tabs";

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

export function WorkspacePageHeader({
  workspaceId,
  workspaceName,
  activeTab,
  breadcrumbLeaf,
  members,
  canInvite,
  tabBarEnd,
}: {
  workspaceId: string;
  workspaceName: string;
  activeTab: WorkspaceTab;
  /** Last segment in the breadcrumb trail, e.g. "Overview". */
  breadcrumbLeaf: string;
  members: HeaderMember[];
  canInvite: boolean;
  /** Right side of the tab row (e.g. filter / add-task controls on the board). */
  tabBarEnd?: ReactNode;
}) {
  return (
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
            {workspaceName}
          </Link>
          <span className="text-ink-faint">›</span>
          <span className="truncate text-ink">{breadcrumbLeaf}</span>
        </nav>

        <WorkspaceHeaderActions
          members={members}
          workspaceId={workspaceId}
          canInvite={canInvite}
        />
      </div>

      <h1 className="mt-5 text-[3rem] font-semibold leading-tight tracking-tight text-ink sm:text-[3.375rem]">
        {workspaceName}
      </h1>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <WorkspaceTabs workspaceId={workspaceId} activeTab={activeTab} />
        {tabBarEnd ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {tabBarEnd}
          </div>
        ) : null}
      </div>
    </header>
  );
}
