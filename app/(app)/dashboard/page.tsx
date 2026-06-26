import { requireUser } from "@/lib/auth";
import {
  getWorkspaceDashboardMembers,
  getWorkspaceDashboardStats,
  listUserWorkspaces,
} from "@/lib/services/workspace";
import { CreateWorkspaceForm } from "@/components/create-workspace-form";
import { WorkspaceCard } from "@/components/workspace-card";
import { SHELL_BRAND_ROW } from "@/components/app-shell-shared";
import { ui } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const workspaces = await listUserWorkspaces(user.id);
  const workspaceIds = workspaces.map((m) => m.workspace.id);
  const [statsByWorkspace, membersByWorkspace] = await Promise.all([
    getWorkspaceDashboardStats(user.id, workspaceIds),
    getWorkspaceDashboardMembers(workspaceIds),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl">
      <div className={SHELL_BRAND_ROW}>
        <h1 className={ui.pageTitle}>Workspaces</h1>
      </div>

      <section className="mt-6 rounded-2xl bg-paper p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-ink">Your workspaces</h2>
          <div className="w-full sm:max-w-md">
            <CreateWorkspaceForm />
          </div>
        </div>

        {workspaces.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-8 py-14 text-center">
            <p className="text-lg font-medium text-ink">
              A blank slate, full of potential.
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Create your first workspace above, or join one via an invite link.
            </p>
          </div>
        ) : (
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
        )}
      </section>
    </main>
  );
}
