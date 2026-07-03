import {
  getOpenTaskCountsByWorkspace,
  listSidebarWorkspaces,
} from "@/lib/services/workspace";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarAccount } from "@/components/layout/sidebar-account";
import { AppRealtimeSync } from "@/components/layout/app-realtime-sync";
import { SHELL_SIDEBAR_X } from "@/components/layout/app-shell-shared";

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
      <div
        className={`mt-8 flex min-h-0 flex-1 flex-col overflow-hidden ${SHELL_SIDEBAR_X}`}
      >
        <SidebarNav workspaces={workspaceNavData} />

        <div className="mt-auto shrink-0 pt-6">
          <SidebarAccount userId={userId} userLabel={userLabel} />
        </div>
      </div>
    </>
  );
}
