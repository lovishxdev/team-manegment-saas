"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberAvatar } from "@/components/members/member-avatar-stack";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import {
  DashboardSearch,
  DashboardSearchResultsSkeleton,
} from "@/components/dashboard/dashboard-search";
import { DashboardSneakPeek } from "@/components/dashboard/dashboard-sneak-peek";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { loadDashboardSearchIndex } from "@/lib/actions/dashboard";
import {
  filterDashboardSearchTasks,
  filterDashboardWorkspaces,
} from "@/lib/dashboard-search";
import type {
  DashboardHomeSummary,
  DashboardSearchTask,
  WorkspaceDashboardStats,
} from "@/lib/services/workspace";
import { ui } from "@/components/ui/ui";

type WorkspaceEntry = {
  workspace: {
    id: string;
    name: string;
    _count: { memberships: number };
  };
  role: string;
};

function WorkspaceGrid({
  workspaces,
  statsByWorkspace,
  membersByWorkspace,
  showHeading = false,
}: {
  workspaces: WorkspaceEntry[];
  statsByWorkspace: Map<string, WorkspaceDashboardStats>;
  membersByWorkspace: Map<string, MemberAvatar[]>;
  showHeading?: boolean;
}) {
  if (workspaces.length === 0) {
    return (
      <section className={ui.dashboardPanel}>
        <p className="rounded-lg border border-line/70 bg-paper/80 px-3 py-2.5 text-sm text-ink-soft">
          No workspaces match your search.
        </p>
      </section>
    );
  }

  return (
    <section className={ui.dashboardPanel}>
      {showHeading ? (
        <h2 className="mb-2 text-sm font-semibold text-ink">Workspaces</h2>
      ) : null}
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {workspaces.map(({ workspace, role }) => (
          <WorkspaceCard
            key={workspace.id}
            id={workspace.id}
            name={workspace.name}
            role={role}
            memberCount={workspace._count.memberships}
            members={membersByWorkspace.get(workspace.id) ?? []}
            stats={
              statsByWorkspace.get(workspace.id) ?? {
                openTasks: 0,
                assignedToYou: 0,
              }
            }
          />
        ))}
      </ul>
    </section>
  );
}

export function DashboardContent({
  userLabel,
  home,
  workspaces,
  statsByWorkspace,
  membersByWorkspace,
}: {
  userLabel: string | null;
  home: DashboardHomeSummary;
  workspaces: WorkspaceEntry[];
  statsByWorkspace: Map<string, WorkspaceDashboardStats>;
  membersByWorkspace: Map<string, MemberAvatar[]>;
}) {
  const [query, setQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState<DashboardSearchTask[] | null>(
    null
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRequestRef = useRef(0);

  const searching = query.trim().length > 0;

  useEffect(() => {
    if (!searching) return;
    if (searchIndex !== null) return;

    const requestId = ++searchRequestRef.current;
    setSearchLoading(true);

    void loadDashboardSearchIndex()
      .then((index) => {
        if (requestId !== searchRequestRef.current) return;
        setSearchIndex(index);
      })
      .finally(() => {
        if (requestId !== searchRequestRef.current) return;
        setSearchLoading(false);
      });
  }, [searching, searchIndex]);

  const results = useMemo(
    () =>
      searchIndex ? filterDashboardSearchTasks(searchIndex, query) : [],
    [searchIndex, query]
  );

  const matchingWorkspaceIds = useMemo(
    () => new Set(results.map((task) => task.workspaceId)),
    [results]
  );

  const visibleWorkspaces = useMemo(
    () =>
      searchIndex
        ? filterDashboardWorkspaces(workspaces, query, matchingWorkspaceIds)
        : workspaces,
    [workspaces, query, matchingWorkspaceIds, searchIndex]
  );

  return (
    <>
      <DashboardGreeting
        userLabel={userLabel}
        workspaceCount={home.workspaceCount}
        openTasks={home.openTasks}
        assignedToYou={home.assignedToYou}
      />

      <DashboardSearch.Input query={query} onQueryChange={setQuery} />

      {searching ? (
        searchLoading || searchIndex === null ? (
          <DashboardSearchResultsSkeleton query={query} />
        ) : (
          <DashboardSearch.Results query={query} results={results} />
        )
      ) : null}

      {!searching ? <DashboardSneakPeek tasks={home.taskPeeks} /> : null}

      {workspaces.length === 0 ? (
        <section className={ui.dashboardPanel}>
          <div className="flex flex-col items-center rounded-xl border border-dashed border-line/80 px-8 py-16 text-center">
            <div
              aria-hidden
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-paper-deep/60 ring-1 ring-line/60"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7 text-ink-faint"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
              </svg>
            </div>
            <p className="text-lg font-medium text-ink">A blank slate</p>
            <p className="mt-1 max-w-sm text-sm text-ink-soft">
              Use <span className="font-medium text-ink">New workspace</span> in
              the sidebar, or join one via an invite link.
            </p>
          </div>
        </section>
      ) : searching ? (
        searchLoading || searchIndex === null ? (
          <section className={ui.dashboardPanel}>
            <div className="h-3 w-24 animate-pulse rounded bg-paper-deep/70" />
            <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <li
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-paper-deep/70"
                />
              ))}
            </ul>
          </section>
        ) : (
          <WorkspaceGrid
            workspaces={visibleWorkspaces}
            statsByWorkspace={statsByWorkspace}
            membersByWorkspace={membersByWorkspace}
            showHeading
          />
        )
      ) : (
        <WorkspaceGrid
          workspaces={workspaces}
          statsByWorkspace={statsByWorkspace}
          membersByWorkspace={membersByWorkspace}
        />
      )}
    </>
  );
}
