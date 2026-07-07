import { Suspense } from "react";
import { AppShellClient } from "@/components/layout/app-shell-client";
import { AppShellIntegrationsLoader } from "@/components/layout/app-shell-integrations-loader";
import { AppShellMobileUser } from "@/components/layout/app-shell-mobile-user";
import { AppShellSidebarLoader } from "@/components/layout/app-shell-sidebar-loader";
import { SidebarFrameForAppShell } from "@/components/layout/sidebar-frame-for-app-shell";
import { MobileUserSkeleton } from "@/components/ui/app-shell-skeleton";

export type { WorkspaceTab } from "@/components/layout/app-shell-shared";

/** Static app frame — paints immediately; sidebar and chrome stream in via Suspense. */
export function AppShell({
  sidebarCollapsed = false,
  modal,
  children,
}: {
  sidebarCollapsed?: boolean;
  modal?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AppShellClient
      sidebarCollapsed={sidebarCollapsed}
      modal={modal}
      sidebar={
        <SidebarFrameForAppShell>
          <AppShellSidebarLoader />
        </SidebarFrameForAppShell>
      }
      mobileUser={
        <Suspense fallback={<MobileUserSkeleton />}>
          <AppShellMobileUser />
        </Suspense>
      }
      integrations={
        <Suspense fallback={null}>
          <AppShellIntegrationsLoader />
        </Suspense>
      }
    >
      {children}
    </AppShellClient>
  );
}
