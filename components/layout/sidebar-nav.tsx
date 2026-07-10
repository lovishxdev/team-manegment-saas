"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GripVertical, LayoutGrid, Settings, CreditCard } from "lucide-react";
import { useCreateWorkspaceModal } from "@/components/layout/create-workspace-modal-provider";
import { OpenSettingsLink } from "@/components/settings/open-settings-link";
import { isAccountSettingsPath } from "@/lib/account-settings";
import {
  WORKSPACE_TAB_LINKS,
  parseWorkspaceRoute,
} from "@/lib/workspace-nav";
import { ui } from "@/components/ui/ui";

type WorkspaceEntry = {
  id: string;
  name: string;
  openTasks: number;
};

function NavIcon({ name }: { name: "dashboard" | "settings" | "pricing" }) {
  const cls = "h-[17px] w-[17px] shrink-0";
  switch (name) {
    case "dashboard":
      return <LayoutGrid className={cls} strokeWidth={1.75} />;
    case "settings":
      return <Settings className={cls} strokeWidth={1.75} />;
    case "pricing":
      return <CreditCard className={cls} strokeWidth={1.75} />;
  }
}

function Badge({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count);
  const wide = label.length > 1;

  return (
    <span
      className={`inline-flex h-[18px] shrink-0 items-center justify-center rounded-full bg-ink/90 font-mono text-[10px] font-medium tabular-nums leading-none text-white ${
        wide ? "min-w-[18px] px-1.5" : "w-[18px]"
      }`}
    >
      {label}
    </span>
  );
}

const workspaceSectionLink =
  "flex w-full min-w-0 items-center rounded-md px-2.5 py-2 text-sm transition-colors text-ink-soft hover:bg-paper hover:text-ink";

const workspaceSectionLinkActive =
  "bg-paper font-medium text-ink";

export function SidebarNav({ workspaces }: { workspaces: WorkspaceEntry[] }) {
  const pathname = usePathname();
  const workspaceRoute = parseWorkspaceRoute(pathname);
  const activeWorkspaceId = workspaceRoute?.workspaceId;
  const activeTab = workspaceRoute?.tab ?? "board";
  const { open: openCreateWorkspace } = useCreateWorkspaceModal();
  const onDashboard = pathname === "/dashboard";
  const onSettings = isAccountSettingsPath(pathname);

  return (
    <nav className="flex min-h-0 flex-1 flex-col pb-4">
      <div className="shrink-0 pb-3">
        <button
          type="button"
          onClick={openCreateWorkspace}
          className="flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong/70 bg-paper px-3 text-sm text-ink-soft shadow-sm transition hover:border-line-strong hover:text-ink"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          <span className="truncate">New workspace</span>
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <Link
          href="/dashboard"
          className={`${ui.navItem} ${onDashboard ? ui.navItemActive : ""}`}
        >
          <NavIcon name="dashboard" />
          <span className="flex-1">Dashboard</span>
        </Link>

        <OpenSettingsLink
          className={`${ui.navItem} ${onSettings ? ui.navItemActive : ""}`}
        >
          <NavIcon name="settings" />
          <span className="flex-1">Settings</span>
        </OpenSettingsLink>

        <Link
          href="/pricing"
          className={`${ui.navItem} ${pathname === "/pricing" ? ui.navItemActive : ""}`}
        >
          <NavIcon name="pricing" />
          <span className="flex-1">Pricing</span>
        </Link>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 flex items-center justify-between px-2.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-faint">
            Workspaces
          </span>
          <button
            type="button"
            onClick={openCreateWorkspace}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition hover:bg-white/70 hover:text-ink"
            title="New workspace"
            aria-label="New workspace"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-1 pr-2.5">
          {workspaces.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-ink-faint">No workspaces yet</p>
          ) : (
            <ul className="flex flex-col gap-0.5 pb-5">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                return (
                  <li key={ws.id}>
                    <Link
                      href={`/w/${ws.id}`}
                      className={`${ui.navSubItem} ${
                        isActive
                          ? `${ui.navSubItemActive} max-md:bg-transparent max-md:shadow-none`
                          : ""
                      }`}
                    >
                      <GripVertical
                        className="h-4 w-4 shrink-0 text-ink-faint"
                        strokeWidth={1.75}
                      />
                      <span className="flex-1 truncate">{ws.name}</span>
                      {ws.openTasks > 0 ? <Badge count={ws.openTasks} /> : null}
                    </Link>

                    {isActive ? (
                      <div className="md:hidden">
                        <ul
                          className="mx-1.5 mb-1.5 mt-1 flex flex-col gap-0.5 rounded-lg border border-line bg-paper-deep/50 p-1"
                          aria-label="Workspace sections"
                        >
                          {WORKSPACE_TAB_LINKS.map((tab) => {
                            const href = `/w/${ws.id}${tab.path}`;
                            const sectionActive = activeTab === tab.id;
                            return (
                              <li key={tab.id}>
                                <Link
                                  href={href}
                                  className={`${workspaceSectionLink} ${
                                    sectionActive ? workspaceSectionLinkActive : ""
                                  }`}
                                >
                                  {tab.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
}
