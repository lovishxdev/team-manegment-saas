import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listUserWorkspaces } from "@/lib/services/workspace";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { CreateWorkspaceForm } from "@/components/create-workspace-form";
import { OverviewCard } from "@/components/dashboard-overview";
import { ui } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const workspaces = await listUserWorkspaces(user.id);
  const workspaceIds = workspaces.map((m) => m.workspace.id);

  const [openTasks, doneTasks, memberRows] = await Promise.all([
    workspaceIds.length
      ? prisma.task.count({
          where: {
            workspaceId: { in: workspaceIds },
            status: { not: "DONE" },
          },
        })
      : 0,
    workspaceIds.length
      ? prisma.task.count({
          where: {
            workspaceId: { in: workspaceIds },
            status: "DONE",
          },
        })
      : 0,
    workspaceIds.length
      ? prisma.workspaceMembership.findMany({
          where: { workspaceId: { in: workspaceIds } },
          select: { userId: true },
        })
      : [],
  ]);

  const uniqueMembers = new Set(memberRows.map((m) => m.userId)).size;

  return (
    <AppShell userId={user.id} userLabel={user.username ?? user.email}>
      <main className="mx-auto w-full max-w-6xl">
        <div className={ui.pageTitleRow}>
          <h1 className={ui.pageTitle}>Workspace overview</h1>
        </div>

        <div className="mt-6">
          <OverviewCard
            openTasks={openTasks}
            totalMembers={uniqueMembers}
            doneTasks={doneTasks}
          />
        </div>

        <section className="mt-10 rounded-2xl bg-paper p-6 shadow-sm sm:p-8">
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
                <Link
                  key={workspace.id}
                  href={`/w/${workspace.id}`}
                  className="group rounded-xl border border-line/80 bg-shell p-5 transition hover:border-line-strong hover:bg-paper-deep/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-paper text-base font-semibold text-ink shadow-sm">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="rounded-full bg-paper px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft shadow-sm">
                      {role.replace("_", " ")}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">
                    {workspace.name}
                  </h3>
                  <p className="mt-1 text-xs text-ink-faint">
                    {workspace._count.tasks} task
                    {workspace._count.tasks === 1 ? "" : "s"} ·{" "}
                    {workspace._count.memberships} member
                    {workspace._count.memberships === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
