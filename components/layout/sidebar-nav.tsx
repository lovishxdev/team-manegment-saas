"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GripVertical } from "lucide-react";
import { useCreateWorkspaceModal } from "@/components/layout/create-workspace-modal-provider";
import { ui } from "@/components/ui/ui";

type WorkspaceEntry = {
  id: string;
  name: string;
  openTasks: number;
};

function NavIcon({ name }: { name: "dashboard" | "settings" }) {
  const cls = "h-[17px] w-[17px] shrink-0";
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
          <rect x="2" y="2" width="5.5" height="5.5" rx="1.2" />
          <rect x="10.5" y="2" width="5.5" height="5.5" rx="1.2" />
          <rect x="2" y="10.5" width="5.5" height="5.5" rx="1.2" />
          <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1.2" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
          <circle cx="9" cy="9" r="2.25" />
          <path d="M9 1.5v1.5M9 15v1.5M1.5 9H3M15 9h1.5M3.4 3.4l1.06 1.06M13.54 13.54l1.06 1.06M3.4 14.6l1.06-1.06M13.54 4.46l1.06-1.06" />
        </svg>
      );
  }
}

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink/90 px-1 font-mono text-[10px] font-medium leading-none text-white">
      {count}
    </span>
  );
}

function useActiveWorkspaceId(): string | undefined {
  const pathname = usePathname();
  const match = pathname.match(/^\/w\/([^/]+)/);
  return match?.[1];
}

export function SidebarNav({ workspaces }: { workspaces: WorkspaceEntry[] }) {
  const pathname = usePathname();
  const activeWorkspaceId = useActiveWorkspaceId();
  const { open: openCreateWorkspace } = useCreateWorkspaceModal();
  const onDashboard = pathname === "/dashboard";
  const onSettings = pathname === "/settings";

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

        <Link
          href="/settings"
          className={`${ui.navItem} ${onSettings ? ui.navItemActive : ""}`}
        >
          <NavIcon name="settings" />
          <span className="flex-1">Settings</span>
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
                      className={`${ui.navSubItem} ${isActive ? ui.navSubItemActive : ""}`}
                    >
                      <GripVertical
                        className="h-4 w-4 shrink-0 text-ink-faint"
                        strokeWidth={1.75}
                      />
                      <span className="flex-1 truncate">{ws.name}</span>
                      {ws.openTasks > 0 ? <Badge count={ws.openTasks} /> : null}
                    </Link>
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
