import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { displayUser } from "@/lib/username";
import {
  getDashboardHomeSummary,
  getWorkspaceDashboardMembers,
  getWorkspaceDashboardStats,
  listUserWorkspaces,
} from "@/lib/services/workspace";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { SHELL_CONTENT_MAX } from "@/components/layout/app-shell-shared";
import { DashboardGridSkeleton } from "@/components/ui/app-shell-skeleton";

async function DashboardHome() {
  const user = await requireUser();
  const userId = user.id;
  const userLabel = displayUser(user);

  const workspaces = await listUserWorkspaces(userId);
  const workspaceIds = workspaces.map((m) => m.workspace.id);

  const [home, statsByWorkspace, membersByWorkspace] = await Promise.all([
    getDashboardHomeSummary(userId),
    getWorkspaceDashboardStats(userId, workspaceIds),
    getWorkspaceDashboardMembers(workspaceIds),
  ]);

  return (
    <DashboardContent
      userLabel={userLabel}
      home={home}
      workspaces={workspaces}
      statsByWorkspace={statsByWorkspace}
      membersByWorkspace={membersByWorkspace}
    />
  );
}

export default function DashboardPage() {
  return (
    <main className={SHELL_CONTENT_MAX}>
      <Suspense fallback={<DashboardGridSkeleton />}>
        <DashboardHome />
      </Suspense>
    </main>
  );
}
