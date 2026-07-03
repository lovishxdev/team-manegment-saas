import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/ui";
import { MobileWorkspaceTabs } from "@/components/layout/mobile-workspace-tabs";
import { AppShellSidebar } from "@/components/layout/app-shell-sidebar";
import { AppShellIntegrations } from "@/components/layout/app-shell-integrations";
import { SidebarNavSkeleton } from "@/components/ui/app-shell-skeleton";
import {
  SHELL_BRAND_ROW,
  SHELL_MAIN_X,
  SHELL_SIDEBAR_X,
  SHELL_TOP,
} from "@/components/layout/app-shell-shared";

export type { WorkspaceTab } from "@/components/layout/app-shell-shared";

/** Static app frame — paints immediately; sidebar and banners stream in via Suspense. */
export function AppShell({
  userId,
  userLabel,
  userPhone,
  whatsappChatCached,
  children,
}: {
  userId: string;
  userLabel: string | null;
  userPhone: string | null;
  whatsappChatCached: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-start">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-hidden pb-6 md:flex lg:w-64">
        <header className={`${SHELL_SIDEBAR_X} ${SHELL_TOP}`}>
          <Link href="/dashboard" className={`${SHELL_BRAND_ROW} gap-2.5 px-2`}>
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={39}
              height={39}
              className="block shrink-0 rounded-md"
              priority
            />
            <span className="text-[1.375rem] font-semibold leading-none tracking-tight">
              Euclis
            </span>
          </Link>
        </header>

        <Suspense fallback={<SidebarNavSkeleton />}>
          <AppShellSidebar userId={userId} userLabel={userLabel} />
        </Suspense>
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
              priority
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
          <div className={`${SHELL_MAIN_X} pb-8 ${SHELL_TOP}`}>
            <Suspense fallback={null}>
              <AppShellIntegrations
                userId={userId}
                userPhone={userPhone}
                whatsappChatCached={whatsappChatCached}
              />
            </Suspense>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
