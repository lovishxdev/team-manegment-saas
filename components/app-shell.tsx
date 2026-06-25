import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";
import { listUserWorkspaces } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui";
import { SidebarNav } from "@/components/sidebar-nav";
import { AppRealtimeSync } from "@/components/app-realtime-sync";
import { MobileWorkspaceTabs } from "@/components/mobile-workspace-tabs";
import { WhatsAppPhonePrompt } from "@/components/whatsapp-phone-prompt";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
  whatsAppBotDeepLink,
} from "@/lib/whatsapp-bot";
import { SHELL_BRAND_ROW, SHELL_TOP } from "@/components/app-shell-shared";

export type { WorkspaceTab } from "@/components/app-shell-shared";

/** Full-viewport app frame: sidebar + scrollable main, no outer frame or inset panel.
 *
 * Lives in the persistent app layout, so it renders once and survives
 * navigation between sibling routes (board/members/assets, dashboard, etc.)
 * instead of refetching the sidebar on every click. Active workspace/tab are
 * derived from the URL inside the (client) nav components. */
export async function AppShell({
  userId,
  userLabel,
  children,
}: {
  userId: string;
  userLabel: string | null;
  children: React.ReactNode;
}) {
  // requireUser() is React.cache'd, so within this request render it reuses
  // the row the page already loaded (no extra query) and gives us `phone`
  // without a second user lookup.
  const currentUser = await requireUser();
  const memberships = await listUserWorkspaces(userId);
  const workspaceIds = memberships.map((m) => m.workspace.id);

  // Sidebar badges in two grouped queries instead of 2 counts per workspace
  // (was an N+1 that re-ran on every navigation). Backed by the
  // Task(workspaceId,status) and Asset(workspaceId) indexes.
  const [openTaskGroups, assetGroups] = await Promise.all([
    workspaceIds.length
      ? prisma.task.groupBy({
          by: ["workspaceId"],
          where: { workspaceId: { in: workspaceIds }, status: { not: "DONE" } },
          _count: { _all: true },
        })
      : [],
    workspaceIds.length
      ? prisma.asset.groupBy({
          by: ["workspaceId"],
          where: { workspaceId: { in: workspaceIds } },
          _count: { _all: true },
        })
      : [],
  ]);

  const openByWorkspace = new Map(
    openTaskGroups.map((g) => [g.workspaceId, g._count._all])
  );
  const assetsByWorkspace = new Map(
    assetGroups.map((g) => [g.workspaceId, g._count._all])
  );

  const whatsAppBotNumber = getWhatsAppBotNumber();
  const botDisplay = whatsAppBotNumber
    ? formatWhatsAppBotNumber(whatsAppBotNumber)
    : null;
  const botDeepLink = whatsAppBotNumber
    ? whatsAppBotDeepLink(whatsAppBotNumber)
    : null;

  const workspaceNavData = memberships.map(({ workspace }) => ({
    id: workspace.id,
    name: workspace.name,
    openTasks: openByWorkspace.get(workspace.id) ?? 0,
    memberCount: workspace._count.memberships,
    assetCount: assetsByWorkspace.get(workspace.id) ?? 0,
  }));

  return (
    <>
      <AppRealtimeSync userId={userId} workspaceIds={workspaceIds} />
      <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col pb-6 md:flex lg:w-64">
        <div className={`px-4 ${SHELL_TOP} lg:px-5`}>
          <Link href="/dashboard" className={`${SHELL_BRAND_ROW} gap-2.5 px-2`}>
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={39}
              height={39}
              className="shrink-0 rounded-md"
            />
            <span className="text-[1.375rem] font-semibold leading-none tracking-tight">
              Euclis
            </span>
          </Link>
        </div>

        <div className="mt-8 flex flex-1 flex-col px-4 lg:px-5">
          <SidebarNav workspaces={workspaceNavData} />

          <div className="mt-auto pt-6">
            <div className="flex items-center gap-2.5 px-2 py-1">
              <Avatar seed={userId} label={userLabel} size="h-8 w-8 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {userLabel ?? "Account"}
                </p>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  title="Sign out"
                  className="rounded-lg p-1.5 text-ink-faint transition hover:bg-paper/80 hover:text-ink"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  >
                    <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11l3-3-3-3M13.5 8H6" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={34}
              height={34}
              className="rounded-md"
            />
            <span className="text-sm font-semibold leading-none">Euclis</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href="/settings"
              className="rounded-lg px-2 py-1 text-xs text-ink-soft"
            >
              Settings
            </Link>
            <Avatar seed={userId} label={userLabel} size="h-7 w-7 text-[10px]" />
            <form action={signOutAction}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-paper/80 hover:text-ink"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="1.3"
                >
                  <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11l3-3-3-3M13.5 8H6" />
                </svg>
              </button>
            </form>
          </div>
        </header>

        <MobileWorkspaceTabs />

        <div className="flex-1 overflow-y-auto">
          <div className={`flex flex-col px-6 pb-8 ${SHELL_TOP} sm:px-8`}>
            {!currentUser.phone && (
              <WhatsAppPhonePrompt
                userId={userId}
                botDisplay={botDisplay}
                botDeepLink={botDeepLink}
              />
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
