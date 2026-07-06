import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/ui";
import { MobileWorkspaceTabs } from "@/components/layout/mobile-workspace-tabs";
import { AppShellSidebar } from "@/components/layout/app-shell-sidebar";
import { AppShellIntegrations } from "@/components/layout/app-shell-integrations";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { CreateWorkspaceModalProvider } from "@/components/layout/create-workspace-modal-provider";
import { AppChatFab } from "@/components/app-chat/app-chat-fab";
import { SidebarFrameWithSuspense } from "@/components/layout/sidebar-frame";
import { MainColumn } from "@/components/layout/main-column";
import { SidebarNavSkeleton } from "@/components/ui/app-shell-skeleton";

export type { WorkspaceTab } from "@/components/layout/app-shell-shared";

/** Static app frame — paints immediately; sidebar and banners stream in via Suspense. */
export function AppShell({
  userId,
  userLabel,
  userPhone,
  whatsappChatCached,
  sidebarCollapsed = false,
  children,
}: {
  userId: string;
  userLabel: string | null;
  userPhone: string | null;
  whatsappChatCached: boolean;
  sidebarCollapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultCollapsed={sidebarCollapsed}>
      <CreateWorkspaceModalProvider>
      <div className="flex min-h-screen items-start">
        <SidebarFrameWithSuspense fallback={<SidebarNavSkeleton />}>
          <AppShellSidebar userId={userId} userLabel={userLabel} />
        </SidebarFrameWithSuspense>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shell-glass sticky top-0 z-20 flex items-center justify-between border-b border-line/80 px-4 py-2.5 md:hidden">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/euclis-logo.png"
                alt="Euclis"
                width={32}
                height={32}
                className="h-8 w-8 shrink-0 rounded-md"
                priority
              />
              <span className="sr-only">Euclis</span>
            </Link>
            <div className="flex items-center gap-1">
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
                  className="rounded-lg p-1.5 text-ink-faint transition hover:bg-white/60 hover:text-ink"
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

          <MainColumn>
            <Suspense fallback={null}>
              <AppShellIntegrations
                userId={userId}
                userPhone={userPhone}
                whatsappChatCached={whatsappChatCached}
              />
            </Suspense>
            {children}
          </MainColumn>
        </div>
      </div>
      <AppChatFab />
      </CreateWorkspaceModalProvider>
    </SidebarProvider>
  );
}
