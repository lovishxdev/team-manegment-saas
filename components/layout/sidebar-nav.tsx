"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type WorkspaceEntry = {
  id: string;
  name: string;
  openTasks: number;
};

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

function NavIcon({ name }: { name: "dashboard" | "workspaces" }) {
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
  }
}

function Badge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}

function itemCls(active: boolean) {
  return `flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
    active
      ? "bg-paper font-medium text-ink shadow-sm"
      : "text-ink-soft hover:bg-paper/50 hover:text-ink"
  }`;
}

function subItemCls(active: boolean) {
  return `flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-xl px-2.5 h-9 text-[15px] leading-5 transition ${
    active
      ? "bg-paper font-medium text-ink shadow-sm"
      : "text-ink-soft hover:bg-paper/50 hover:text-ink"
  }`;
}

/** Icon column offset: px-3 (12px) + half of 20px icon = 22px */
const TREE_X = 22;
const ROW_H = 42;
const MID_Y = ROW_H / 2;
/** Horizontal branch at vertically centered label text */
const BRANCH_Y = MID_Y;
/** Vertical run before the bend — sets curve radius */
const CURVE_DEPTH = 7;
const JOIN_Y = BRANCH_Y - CURVE_DEPTH;
/** X where the curved branch ends — no horizontal tail into the label */
const BRANCH_END = 9;
const LABEL_GAP = 6;
const WS_PAD = TREE_X + BRANCH_END + LABEL_GAP;
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
  const branchCurve = `Q 1 ${BRANCH_Y} ${BRANCH_END} ${BRANCH_Y}`;
  const svgH =
    kind === "branch" && !trunkDown
      ? BRANCH_Y + 2
      : trunkDown
        ? ROW_H + TRUNK_BLEED
        : ROW_H;

  let d = "";
  if (kind === "trunk" && trunkDown) {
    d = `M 1 0 V ${ROW_H + TRUNK_BLEED}`;
  } else if (kind === "branch") {
    d = trunkDown
      ? `M 1 0 V ${ROW_H + TRUNK_BLEED} M 1 ${JOIN_Y} ${branchCurve}`
      : `M 1 0 V ${JOIN_Y} ${branchCurve}`;
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

/** Active workspace id from the URL — section tabs live in the page header. */
function useActiveWorkspaceId(): string | undefined {
  const pathname = usePathname();
  const match = pathname.match(/^\/w\/([^/]+)/);
  return match?.[1];
}

export function SidebarNav({ workspaces }: { workspaces: WorkspaceEntry[] }) {
  const pathname = usePathname();
  const activeWorkspaceId = useActiveWorkspaceId();
  const onDashboard = pathname === "/dashboard";
  const [workspacesOpen, setWorkspacesOpen] = useState(
    Boolean(activeWorkspaceId) || onDashboard
  );

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1">
      <Link href="/dashboard" className={itemCls(onDashboard)}>
        <NavIcon name="dashboard" />
        <span className="flex-1">Dashboard</span>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setWorkspacesOpen((v) => !v)}
          className={`${itemCls(false)} w-full shrink-0`}
        >
          <NavIcon name="workspaces" />
          <span className="flex-1 text-left">Workspaces</span>
          <Chevron open={workspacesOpen} />
        </button>

        {workspacesOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
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
              workspaces.map((ws, wsIndex) => {
                const hasWsBelow = wsIndex < workspaces.length - 1;
                const isActive = ws.id === activeWorkspaceId;

                return (
                  <TreeMenuItem
                    key={ws.id}
                    connectors={[
                      {
                        x: TREE_X,
                        kind: "branch",
                        trunkDown: hasWsBelow,
                      },
                    ]}
                    padLeft={WS_PAD}
                  >
                    <Link
                      href={`/w/${ws.id}`}
                      className={subItemCls(isActive)}
                    >
                      <span className="flex-1 truncate">{ws.name}</span>
                      {ws.openTasks > 0 ? <Badge count={ws.openTasks} /> : null}
                    </Link>
                  </TreeMenuItem>
                );
              })
            )}
            </TreeMenu>
          </div>
        )}
      </div>
    </nav>
  );
}
