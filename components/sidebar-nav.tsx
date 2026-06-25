"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { WorkspaceTab } from "@/components/app-shell-shared";

type WorkspaceEntry = {
  id: string;
  name: string;
  openTasks: number;
  memberCount: number;
  assetCount: number;
};

const TAB_META: { id: WorkspaceTab; label: string; path: string }[] = [
  { id: "board", label: "Overview", path: "" },
  { id: "members", label: "Members", path: "/members" },
  { id: "assets", label: "Assets", path: "/assets" },
  { id: "whiteboard", label: "Whiteboard", path: "/whiteboard" },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-3.5 w-3.5 shrink-0 text-ink-faint transition ${open ? "rotate-180" : ""}`}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavIcon({ name }: { name: string }) {
  const cls = "h-5 w-5 shrink-0";
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
    case "workspaces":
      return (
        <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
          <rect x="2.5" y="5" width="13" height="10" rx="1.5" />
          <path d="M6.5 5V3.8A1.3 1.3 0 0 1 7.8 2.5h2.4a1.3 1.3 0 0 1 1.3 1.3V5M2.5 9h13" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 18 18" fill="none" className={cls} stroke="currentColor" strokeWidth="1.4">
          <circle cx="9" cy="9" r="2.2" />
          <path d="M9 2.2v1.8M9 14v1.8M2.2 9h1.8M14 9h1.8M4.1 4.1l1.3 1.3M12.6 12.6l1.3 1.3M13.9 4.1l-1.3 1.3M5.4 12.6l-1.3 1.3" />
        </svg>
      );
    case "board":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.3">
          <rect x="1.5" y="2" width="3.6" height="12" rx="1" />
          <rect x="6.2" y="2" width="3.6" height="8" rx="1" />
          <rect x="10.9" y="2" width="3.6" height="10" rx="1" />
        </svg>
      );
    case "members":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.3">
          <circle cx="5.5" cy="5" r="2.2" />
          <path d="M1.5 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4" />
          <circle cx="11.5" cy="5.5" r="1.8" />
          <path d="M10.5 9.8c2 .2 3.6 1.8 3.9 3.7" />
        </svg>
      );
    case "assets":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.3">
          <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
          <circle cx="5.5" cy="6" r="1.2" />
          <path d="M2 11.5l3.5-3 3 2.5 3-2 2.5 2" />
        </svg>
      );
    case "whiteboard":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.3">
          <path d="M10.8 2.3l2.9 2.9L5.4 13.5l-3.4.5.5-3.4 8.3-8.3z" />
          <path d="M9.3 3.8l2.9 2.9" />
        </svg>
      );
    default:
      return null;
  }
}

function Badge({ count, tone }: { count: number; tone: "orange" | "green" }) {
  const cls =
    tone === "orange"
      ? "bg-orange-400 text-white"
      : "bg-emerald-400 text-white";
  return (
    <span
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ${cls}`}
    >
      {count}
    </span>
  );
}

function itemCls(active: boolean) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
    active
      ? "bg-paper font-medium text-ink shadow-sm"
      : "text-ink-soft hover:bg-paper/50 hover:text-ink"
  }`;
}

function subItemCls(active: boolean) {
  return `flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 h-9 text-[15px] leading-5 transition ${
    active
      ? "bg-paper font-medium text-ink shadow-sm"
      : "text-ink-soft hover:bg-paper/50 hover:text-ink"
  }`;
}

function tabItemCls(active: boolean) {
  return `flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 h-9 text-[15px] leading-5 transition ${
    active
      ? "bg-paper font-medium text-ink shadow-sm"
      : "text-ink-soft hover:bg-paper/50 hover:text-ink"
  }`;
}

/** Icon column offset: px-3 (12px) + half of 20px icon = 22px */
const TREE_X = 22;
/** Extra indent for tab labels under an active workspace (no nested tree lines) */
const TAB_INDENT = 14;
const ROW_H = 42;
const MID_Y = ROW_H / 2;
const CURVE_Y = MID_Y + 7;
/** X where the curved branch ends — no horizontal tail into the label */
const BRANCH_END = 9;
const LABEL_GAP = 6;
const WS_PAD = TREE_X + BRANCH_END + LABEL_GAP;
const TAB_PAD = WS_PAD + TAB_INDENT;
/** Bleed into the next row so adjacent SVG segments meet without a gap */
const TRUNK_BLEED = 1;

type ConnectorKind = "branch" | "trunk";

function TreeConnector({
  x,
  kind,
  trunkDown,
}: {
  x: number;
  kind: ConnectorKind;
  trunkDown: boolean;
}) {
  const svgH =
    kind === "branch" && !trunkDown
      ? CURVE_Y + 2
      : trunkDown
        ? ROW_H + TRUNK_BLEED
        : ROW_H;

  let d = "";
  if (kind === "trunk" && trunkDown) {
    d = `M 1 0 V ${ROW_H + TRUNK_BLEED}`;
  } else if (kind === "branch") {
    d = trunkDown
      ? `M 1 0 V ${ROW_H + TRUNK_BLEED} M 1 ${MID_Y} Q 1 ${CURVE_Y} ${BRANCH_END} ${CURVE_Y}`
      : `M 1 0 V ${MID_Y} Q 1 ${CURVE_Y} ${BRANCH_END} ${CURVE_Y}`;
  }

  if (!d) return null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 overflow-visible"
      style={{ left: x - 1 }}
      width={BRANCH_END + 2}
      height={svgH}
      viewBox={`0 0 ${BRANCH_END + 2} ${svgH}`}
      fill="none"
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="butt"
        strokeLinejoin="round"
        className="text-line-strong"
      />
    </svg>
  );
}

function TreeMenu({ children }: { children: React.ReactNode }) {
  return <ul className="relative mt-1.5 list-none">{children}</ul>;
}

type TreeConnectorSpec = {
  x: number;
  kind: ConnectorKind;
  trunkDown: boolean;
};

function TreeMenuItem({
  children,
  connectors,
  padLeft,
}: {
  children: React.ReactNode;
  connectors: TreeConnectorSpec[];
  padLeft: number;
}) {
  return (
    <li className="relative h-[42px] overflow-visible">
      {connectors.map((c, i) => (
        <TreeConnector key={i} {...c} />
      ))}
      <div className="flex h-[42px] items-center pr-2" style={{ paddingLeft: padLeft }}>
        {children}
      </div>
    </li>
  );
}

function TabMenuItem({
  children,
  connectors,
  padLeft,
}: {
  children: React.ReactNode;
  connectors: TreeConnectorSpec[];
  padLeft: number;
}) {
  const hasTrunk = connectors.length > 0;

  return (
    <li
      className={`relative overflow-visible ${hasTrunk ? "h-[42px]" : "py-[3px]"}`}
    >
      {connectors.map((c, i) => (
        <TreeConnector key={i} {...c} />
      ))}
      <div
        className={hasTrunk ? "flex h-[42px] items-center pr-2" : "pr-2"}
        style={{ paddingLeft: padLeft }}
      >
        {children}
      </div>
    </li>
  );
}

/** Derives the active workspace id + tab from the URL so the sidebar can live
 * in a persistent layout (no per-page props needed). */
function useWorkspaceRoute(): {
  activeWorkspaceId?: string;
  activeTab?: WorkspaceTab;
} {
  const pathname = usePathname();
  const match = pathname.match(
    /^\/w\/([^/]+)(?:\/(members|assets|whiteboard))?/
  );
  if (!match) return {};
  return {
    activeWorkspaceId: match[1],
    activeTab: (match[2] as WorkspaceTab) ?? "board",
  };
}

export function SidebarNav({ workspaces }: { workspaces: WorkspaceEntry[] }) {
  const pathname = usePathname();
  const { activeWorkspaceId, activeTab } = useWorkspaceRoute();
  const onDashboard = pathname === "/dashboard";
  const onSettings = pathname === "/settings";
  const [workspacesOpen, setWorkspacesOpen] = useState(
    Boolean(activeWorkspaceId) || onDashboard
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <nav className="flex flex-1 flex-col gap-1">
      <Link href="/dashboard" className={itemCls(onDashboard)}>
        <NavIcon name="dashboard" />
        <span className="flex-1">Dashboard</span>
      </Link>

      <div>
        <button
          type="button"
          onClick={() => setWorkspacesOpen((v) => !v)}
          className={`${itemCls(false)} w-full`}
        >
          <NavIcon name="workspaces" />
          <span className="flex-1 text-left">Workspaces</span>
          <Chevron open={workspacesOpen} />
        </button>

        {workspacesOpen && (
          <TreeMenu>
            {workspaces.length === 0 ? (
              <TreeMenuItem
                connectors={[
                  {
                    x: TREE_X,
                    kind: "branch",
                    trunkDown: false,
                  },
                ]}
                padLeft={WS_PAD}
              >
                <p className="text-sm text-ink-faint">No workspaces yet</p>
              </TreeMenuItem>
            ) : (
              (() => {
                type Row =
                  | { kind: "ws"; ws: WorkspaceEntry }
                  | { kind: "tab"; ws: WorkspaceEntry; tab: (typeof TAB_META)[number] };

                const rows: Row[] = [];
                for (const ws of workspaces) {
                  rows.push({ kind: "ws", ws });
                  if (ws.id === activeWorkspaceId && activeWorkspace) {
                    for (const tab of TAB_META) {
                      rows.push({ kind: "tab", ws, tab });
                    }
                  }
                }

                return rows.map((row) => {
                  if (row.kind === "ws") {
                    const wsIndex = workspaces.findIndex((w) => w.id === row.ws.id);
                    const hasWsBelow = wsIndex < workspaces.length - 1;
                    const connectors: TreeConnectorSpec[] = [
                      {
                        x: TREE_X,
                        kind: "branch",
                        trunkDown: hasWsBelow,
                      },
                    ];

                    return (
                      <TreeMenuItem
                        key={row.ws.id}
                        connectors={connectors}
                        padLeft={WS_PAD}
                      >
                        <Link
                          href={`/w/${row.ws.id}`}
                          className={subItemCls(false)}
                        >
                          <span className="truncate">{row.ws.name}</span>
                        </Link>
                      </TreeMenuItem>
                    );
                  }

                  const { ws, tab } = row;
                  const wsIndex = workspaces.findIndex((w) => w.id === ws.id);
                  const hasWsBelow = wsIndex < workspaces.length - 1;
                  const connectors: TreeConnectorSpec[] = hasWsBelow
                    ? [{ x: TREE_X, kind: "trunk", trunkDown: true }]
                    : [];

                  const href = `/w/${ws.id}${tab.path}`;
                  const isActive = tab.id === activeTab;
                  const count =
                    tab.id === "board"
                      ? ws.openTasks
                      : tab.id === "members"
                        ? ws.memberCount
                        : tab.id === "assets"
                          ? ws.assetCount
                          : 0;

                  return (
                    <TabMenuItem
                      key={`${ws.id}-${tab.id}`}
                      connectors={connectors}
                      padLeft={TAB_PAD}
                    >
                      <Link href={href} className={tabItemCls(isActive)}>
                        <span className="flex-1 truncate">{tab.label}</span>
                        {tab.id === "board" && count > 0 ? (
                          <Badge count={count} tone="orange" />
                        ) : tab.id === "assets" && count > 0 ? (
                          <Badge count={count} tone="green" />
                        ) : null}
                      </Link>
                    </TabMenuItem>
                  );
                });
              })()
            )}
          </TreeMenu>
        )}
      </div>

      <Link href="/settings" className={itemCls(onSettings)}>
        <NavIcon name="settings" />
        <span className="flex-1">Settings</span>
      </Link>
    </nav>
  );
}
