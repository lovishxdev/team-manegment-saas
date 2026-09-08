"use client";

import type { ReactNode } from "react";
import { AppChatFab } from "@/components/app-chat/app-chat-fab";
import { AppAnnouncementBanner } from "@/components/layout/app-announcement-banner";
import { CreateWorkspaceModalProvider } from "@/components/layout/create-workspace-modal-provider";
import { MainColumn } from "@/components/layout/main-column";
import { MobileHeader } from "@/components/layout/mobile-header";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { AccountSettingsProvider } from "@/components/settings/account-settings-provider";

export function AppShellClient({
  sidebarCollapsed = false,
  sidebar,
  mobileUser,
  integrations,
  modal,
  children,
}: {
  sidebarCollapsed?: boolean;
  sidebar: ReactNode;
  mobileUser: ReactNode;
  integrations: ReactNode;
  modal?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarProvider defaultCollapsed={sidebarCollapsed}>
      <AccountSettingsProvider>
        <CreateWorkspaceModalProvider>
          <div className="app-scope contents">
            <div className="app-canvas flex min-h-screen flex-col">
              <AppAnnouncementBanner />
              <div className="flex min-h-0 min-w-0 flex-1 items-start">
                {sidebar}

                <div className="flex min-w-0 flex-1 flex-col">
                  <MobileHeader userChrome={mobileUser} />

                  <MainColumn>
                    {integrations}
                    {children}
                  </MainColumn>
                </div>
              </div>
            </div>
            {modal}
            <AppChatFab />
          </div>
        </CreateWorkspaceModalProvider>
      </AccountSettingsProvider>
    </SidebarProvider>
  );
}
