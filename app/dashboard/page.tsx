import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listUserWorkspaces } from "@/lib/services/workspace";
import { AppShell } from "@/components/app-shell";
import { CreateWorkspaceForm } from "@/components/create-workspace-form";

export default async function DashboardPage() {
  const user = await requireUser();
  const workspaces = await listUserWorkspaces(user.id);

  return (
    <AppShell userId={user.id} userLabel={user.username ?? user.email}>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Your workspaces
          </h1>
          <div className="w-full sm:w-96">
            <CreateWorkspaceForm />
          </div>
        </div>

        {workspaces.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong p-12 text-center">
            <p className="font-display text-lg text-ink">
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
                className="group rounded-lg border border-line bg-card p-5 transition hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card-high text-base font-semibold text-ink">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    {role.replace("_", " ")}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-lg font-semibold text-ink">
                  {workspace.name}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {workspace._count.tasks} task
                  {workspace._count.tasks === 1 ? "" : "s"} ·{" "}
                  {workspace._count.memberships} member
                  {workspace._count.memberships === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
