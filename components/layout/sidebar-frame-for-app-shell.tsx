"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { isAccountSettingsPath } from "@/lib/account-settings";
import { SidebarFrame } from "@/components/layout/sidebar-frame";
import { SidebarNavSkeleton } from "@/components/ui/app-shell-skeleton";

/**
 * While account settings is open, skip the sidebar skeleton fallback so a
 * re-suspend does not flash ghost loaders behind the modal backdrop.
 */
export function SidebarFrameForAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const settingsOpen = isAccountSettingsPath(pathname);

  if (settingsOpen) {
    return <SidebarFrame>{children}</SidebarFrame>;
  }

  return (
    <SidebarFrame>
      <Suspense fallback={<SidebarNavSkeleton />}>{children}</Suspense>
    </SidebarFrame>
  );
}
