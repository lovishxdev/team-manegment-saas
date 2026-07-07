import {
  getOpenTaskCountsByWorkspace,
  listSidebarWorkspaces,
} from "@/lib/services/workspace";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { AppRealtimeSync } from "@/components/layout/app-realtime-sync";

/** Sidebar nav + realtime subscriptions — streamed after the shell frame paints. */
export async function AppShellSidebar({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string | null;
}) {
  const memberships = await listSidebarWorkspaces(userId);
  const workspaceIds = memberships.map((m) => m.workspace.id);
  const openByWorkspace = await getOpenTaskCountsByWorkspace(workspaceIds);

  const workspaceNavData = memberships.map(({ workspace }) => ({
    id: workspace.id,
    name: workspace.name,
    openTasks: openByWorkspace.get(workspace.id) ?? 0,
  }));

  return (
    <>
      <AppRealtimeSync userId={userId} workspaceIds={workspaceIds} />
      <SidebarContent>
        <SidebarNav workspaces={workspaceNavData} />

        <div className="mt-auto shrink-0 border-t border-line bg-paper pt-4 md:bg-transparent">
          <SidebarAccount userId={userId} userLabel={userLabel} />
        </div>
      </SidebarContent>
    </>
  );
}
