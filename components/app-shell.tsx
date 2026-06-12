import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { listUserWorkspaces } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui";

export type WorkspaceTab = "board" | "members" | "assets" | "whiteboard";

function Icon({ name, className }: { name: string; className?: string }) {
  const cls = className ?? "h-4 w-4";
  switch (name) {
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
    case "settings":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.3">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2" />
        </svg>
      );
    case "ws":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.3">
          <rect x="1.8" y="4.5" width="12.4" height="9" rx="1.5" />
          <path d="M5.5 4.5V3.2A1.2 1.2 0 0 1 6.7 2h2.6a1.2 1.2 0 0 1 1.2 1.2v1.3M1.8 8h12.4" />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth="1.3">
          <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11l3-3-3-3M13.5 8H6" />
        </svg>
      );
    default:
      return null;
  }
}

const TAB_META: { id: WorkspaceTab; label: string; path: string }[] = [
  { id: "board", label: "Board", path: "" },
  { id: "members", label: "Members", path: "/members" },
  { id: "assets", label: "Assets", path: "/assets" },
  { id: "whiteboard", label: "Whiteboard", path: "/whiteboard" },
];

/**
 * Authenticated app frame, "floating panels" layout: an outer warm frame
 * holds a top bar (workspace tabs), a sidebar panel (workspace overview +
 * section nav with counts) and the page content as a white panel.
 * Server component -- fetches the workspace list and sidebar counts itself.
 */
export async function AppShell({
  userId,
  userLabel,
  activeWorkspaceId,
  activeTab,
  children,
}: {
  userId: string;
  /** Display label for the signed-in user (username, falling back to email). */
  userLabel: string | null;
  activeWorkspaceId?: string;
  activeTab?: WorkspaceTab;
  children: React.ReactNode;
}) {
  const workspaces = await listUserWorkspaces(userId);
  const activeEntry = workspaces.find(
    (w) => w.workspace.id === activeWorkspaceId
  );
  const active = activeEntry?.workspace;

  // Sidebar overview data (counts + avatar cluster) for the active workspace.
  const [openTasks, assetCount, previewMembers] = active
    ? await Promise.all([
        prisma.task.count({
          where: { workspaceId: active.id, status: { not: "DONE" } },
        }),
        prisma.asset.count({ where: { workspaceId: active.id } }),
        prisma.workspaceMembership.findMany({
          where: { workspaceId: active.id },
          orderBy: { joinedAt: "asc" },
          take: 5,
          select: {
            user: { select: { id: true, email: true, username: true } },
          },
        }),
      ])
    : [0, 0, []];

  const memberCount = active?._count.memberships ?? 0;
  const roleLabel = activeEntry
    ? activeEntry.role.toLowerCase().replace("_", "-")
    : null;

  const tabs = active
    ? TAB_META.map((t) => ({ ...t, href: `/w/${active.id}${t.path}` }))
    : [];

  const tabCounts: Partial<Record<WorkspaceTab, number>> = {
    board: openTasks,
    members: memberCount,
    assets: assetCount,
  };

  const navItem = (isActive: boolean) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
      isActive
        ? "bg-card-high font-medium text-ink ring-1 ring-line-strong"
        : "text-ink-soft hover:bg-white/[0.04] hover:text-ink"
    }`;

  // Top-bar elements float as individual chips on the backdrop (no bar panel).
  const wsTab = (isActive: boolean) =>
    `flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-xs transition ${
      isActive
        ? "bg-card font-medium text-ink ring-1 ring-accent/40"
        : "bg-white/[0.04] text-ink-soft ring-1 ring-line hover:text-ink hover:ring-line-strong"
    }`;

  const chipBtn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-ink-soft ring-1 ring-line transition hover:text-ink hover:ring-line-strong";

  return (
    <div className="flex min-h-screen flex-col gap-2.5 bg-paper-deep p-2.5 md:h-screen">
      {/* ---------- Top row: floating chips (brand, workspace tabs, account) ---------- */}
      <header className="flex shrink-0 items-center gap-2 px-0.5 pt-0.5">
        <Link
          href="/dashboard"
          className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-card pl-1.5 pr-3.5 ring-1 ring-line"
        >
          <Image
            src="/euclis-logo.png"
            alt="Euclis"
            width={26}
            height={26}
            className="rounded ring-1 ring-line"
          />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Euclis
          </span>
        </Link>
        <span className="h-5 w-px shrink-0 bg-line-strong" />

        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
          {workspaces.map(({ workspace }) => (
            <Link
              key={workspace.id}
              href={`/w/${workspace.id}`}
              className={wsTab(workspace.id === activeWorkspaceId)}
            >
              <Icon name="ws" className="h-3.5 w-3.5 opacity-70" />
              <span className="max-w-32 truncate">{workspace.name}</span>
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-dashed border-line-strong px-3.5 text-xs text-ink-faint transition hover:border-accent/50 hover:text-ink"
          >
            + New
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/settings" title="Settings" className={chipBtn}>
            <Icon name="settings" />
          </Link>
          <form action={signOutAction}>
            <button title="Sign out" className={chipBtn}>
              <Icon name="logout" />
            </button>
          </form>
          <Avatar seed={userId} label={userLabel} size="h-9 w-9 text-xs" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-2.5">
        {/* ---------- Sidebar panel (md+) ---------- */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto rounded-lg border border-line bg-paper md:flex">
          {active ? (
            <>
              <div className="px-5 pb-4 pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-base font-semibold text-paper">
                  {active.name.charAt(0).toUpperCase()}
                </span>
                <h2 className="mt-3 truncate text-lg font-semibold tracking-tight">
                  {active.name}
                </h2>

                {previewMembers.length > 0 && (
                  <div className="mt-2.5 flex items-center">
                    <div className="flex -space-x-1.5">
                      {previewMembers.map((m) => (
                        <span key={m.user.id} className="rounded-full ring-2 ring-paper">
                          <Avatar
                            seed={m.user.id}
                            label={m.user.username ?? m.user.email}
                            size="h-6 w-6 text-[10px]"
                          />
                        </span>
                      ))}
                    </div>
                    {memberCount > previewMembers.length && (
                      <span className="pl-2 text-[11px] text-ink-faint">
                        +{memberCount - previewMembers.length}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3.5 flex flex-col gap-1.5 font-mono text-[11px] tracking-wide text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {openTasks} open task{openTasks === 1 ? "" : "s"}
                  </span>
                  {roleLabel && (
                    <span className="flex items-center gap-1.5 capitalize">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      {roleLabel}
                    </span>
                  )}
                </div>
              </div>

              <div className="mx-4 mb-3 border-t border-line" />

              <nav className="flex flex-col gap-1 px-3">
                {tabs.map((tab) => {
                  const count = tabCounts[tab.id];
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className={navItem(tab.id === activeTab)}
                    >
                      <Icon name={tab.id} />
                      <span className="flex-1">{tab.label}</span>
                      {tab.id === "assets" && count ? (
                        <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-on-accent">
                          {count}
                        </span>
                      ) : count ? (
                        <span className="font-mono text-xs text-ink-faint">
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </>
          ) : (
            <div className="px-3 pt-5">
              <p className="px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Workspaces
              </p>
              <nav className="flex flex-col gap-0.5">
                {workspaces.map(({ workspace }) => (
                  <Link
                    key={workspace.id}
                    href={`/w/${workspace.id}`}
                    className={navItem(false)}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-card-high text-[10px] font-semibold text-ink-soft">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{workspace.name}</span>
                  </Link>
                ))}
              </nav>
            </div>
          )}

          <div className="mt-auto border-t border-line px-3 py-3">
            <Link href="/settings" className={navItem(false)}>
              <Icon name="settings" />
              Settings
            </Link>
            <div className="mt-2 flex items-center gap-2.5 px-3 py-1.5">
              <Avatar seed={userId} label={userLabel} size="h-7 w-7 text-xs" />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
                {userLabel}
              </span>
            </div>
          </div>
        </aside>

        {/* ---------- Content panel ---------- */}
        <div className="min-w-0 flex-1 rounded-lg border border-line bg-paper md:overflow-y-auto">
          {/* Section nav for mobile (sidebar is hidden) */}
          {active && (
            <nav className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs transition ${
                    tab.id === activeTab
                      ? "bg-card-high font-medium text-ink ring-1 ring-line-strong"
                      : "text-ink-soft hover:bg-white/[0.04]"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
