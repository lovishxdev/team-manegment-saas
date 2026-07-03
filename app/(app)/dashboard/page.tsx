import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import {
  getWorkspaceDashboardMembers,
  getWorkspaceDashboardStats,
  listUserWorkspaces,
} from "@/lib/services/workspace";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { SHELL_BRAND_ROW } from "@/components/layout/app-shell-shared";
import { DashboardGridSkeleton } from "@/components/ui/app-shell-skeleton";
import { ui } from "@/components/ui/ui";

async function DashboardWorkspaces() {
  const user = await requireUser();
  const userId = user.id;
  const workspaces = await listUserWorkspaces(userId);
  const workspaceIds = workspaces.map((m) => m.workspace.id);
  const [statsByWorkspace, membersByWorkspace] = await Promise.all([
    getWorkspaceDashboardStats(userId, workspaceIds),
    getWorkspaceDashboardMembers(workspaceIds),
  ]);

  if (workspaces.length === 0) {
    return (
      <section className={ui.dashboardPanel}>
        <div className="rounded-xl border border-dashed border-line/80 px-8 py-14 text-center">
          <p className="text-lg font-medium text-ink">
            A blank slate, full of potential.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Create your first workspace above, or join one via an invite link.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={ui.dashboardPanel}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map(({ workspace, role }) => (
          <WorkspaceCard
            key={workspace.id}
            id={workspace.id}
            name={workspace.name}
            role={role}
            memberCount={workspace._count.memberships}
            members={membersByWorkspace.get(workspace.id) ?? []}
            stats={
              statsByWorkspace.get(workspace.id) ?? {
                openTasks: 0,
                assignedToYou: 0,
              }
            }
          />
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className={SHELL_BRAND_ROW}>
          <h1 className={ui.pageTitle}>Workspaces</h1>
        </div>
        <div className="w-full sm:max-w-md sm:shrink-0">
          <CreateWorkspaceForm />
        </div>
      </div>

      <Suspense fallback={<DashboardGridSkeleton />}>
        <DashboardWorkspaces />
      </Suspense>
    </main>
  );
}
