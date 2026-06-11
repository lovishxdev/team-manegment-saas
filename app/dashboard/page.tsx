import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listUserWorkspaces } from "@/lib/services/workspace";
import { AppNav } from "@/components/app-nav";
import { CreateWorkspaceForm } from "@/components/create-workspace-form";

export default async function DashboardPage() {
  const user = await requireUser();
  const workspaces = await listUserWorkspaces(user.id);

  return (
    <div>
      <AppNav email={user.email} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Your workspaces</h1>
          <div className="w-full sm:w-96">
            <CreateWorkspaceForm />
          </div>
        </div>

        {workspaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-sm text-zinc-500">
            No workspaces yet. Create one above, or join via an invite link.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map(({ workspace, role }) => (
              <Link
                key={workspace.id}
                href={`/w/${workspace.id}`}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-indigo-500/50 hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <h2 className="font-medium group-hover:text-indigo-300">
                    {workspace.name}
                  </h2>
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                    {role.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
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
    </div>
  );
}
