import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";
import { listUserWorkspaces } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui";
import { SidebarNav } from "@/components/sidebar-nav";
import { AppRealtimeSync } from "@/components/app-realtime-sync";
import { WhatsAppPhonePrompt } from "@/components/whatsapp-phone-prompt";
import {
  formatWhatsAppBotNumber,
  getWhatsAppBotNumber,
  whatsAppBotDeepLink,
} from "@/lib/whatsapp-bot";
import {
  SHELL_BRAND_ROW,
  SHELL_TOP,
  type WorkspaceTab,
} from "@/components/app-shell-shared";

export type { WorkspaceTab } from "@/components/app-shell-shared";

/** Full-viewport app frame: sidebar + scrollable main, no outer frame or inset panel. */
export async function AppShell({
  userId,
  userLabel,
  activeWorkspaceId,
  activeTab,
  children,
}: {
  userId: string;
  userLabel: string | null;
  activeWorkspaceId?: string;
  activeTab?: WorkspaceTab;
  children: React.ReactNode;
}) {
  const memberships = await listUserWorkspaces(userId);

  const userPhone = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });

  const whatsAppBotNumber = getWhatsAppBotNumber();
  const botDisplay = whatsAppBotNumber
    ? formatWhatsAppBotNumber(whatsAppBotNumber)
    : null;
  const botDeepLink = whatsAppBotNumber
    ? whatsAppBotDeepLink(whatsAppBotNumber)
    : null;

  const workspaceNavData = await Promise.all(
    memberships.map(async ({ workspace }) => {
      const [openTasks, assetCount] = await Promise.all([
        prisma.task.count({
          where: { workspaceId: workspace.id, status: { not: "DONE" } },
        }),
        prisma.asset.count({ where: { workspaceId: workspace.id } }),
      ]);
      return {
        id: workspace.id,
        name: workspace.name,
        openTasks,
        memberCount: workspace._count.memberships,
        assetCount,
      };
    })
  );

  return (
    <>
      <AppRealtimeSync userId={userId} />
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
          <SidebarNav
            workspaces={workspaceNavData}
            activeWorkspaceId={activeWorkspaceId}
            activeTab={activeTab}
          />

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
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="rounded-lg px-2 py-1 text-xs text-ink-soft"
            >
              Settings
            </Link>
            <Avatar seed={userId} label={userLabel} size="h-7 w-7 text-[10px]" />
          </div>
        </header>

        {activeWorkspaceId && activeTab && (
          <nav className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 md:hidden">
            {(
              [
                { id: "board" as const, label: "Overview", path: "" },
                { id: "members" as const, label: "Members", path: "/members" },
                { id: "assets" as const, label: "Assets", path: "/assets" },
                {
                  id: "whiteboard" as const,
                  label: "Whiteboard",
                  path: "/whiteboard",
                },
              ] as const
            ).map((tab) => (
              <Link
                key={tab.id}
                href={`/w/${activeWorkspaceId}${tab.path}`}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${
                  tab.id === activeTab
                    ? "bg-paper font-medium text-ink shadow-sm"
                    : "text-ink-soft"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className={`flex flex-col px-6 pb-8 ${SHELL_TOP} sm:px-8`}>
            {!userPhone?.phone && (
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
