import Link from "next/link";
import type {
  AdminOverview,
  AdminStat,
} from "@/lib/services/admin";
import { ui } from "@/components/ui/ui";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function StatCard({ stat }: { stat: AdminStat }) {
  return (
    <div className="rounded-xl border border-line/70 bg-paper/90 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {stat.label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {stat.value.toLocaleString()}
      </p>
      {stat.hint ? (
        <p className="mt-1 text-xs text-ink-faint">{stat.hint}</p>
      ) : null}
    </div>
  );
}

function StatSection({ title, stats }: { title: string; stats: AdminStat[] }) {
  return (
    <section>
      <h2 className={ui.sectionTitle}>{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

export function AdminOverview({ overview }: { overview: AdminOverview }) {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={ui.pageTitle}>Overview</h1>
            <p className={ui.pageSubtitle}>
              Read-only production metrics. Generated {formatWhen(overview.generatedAt)}.
            </p>
          </div>
          <Link href="/admin/users" className={`${ui.btnSecondary} text-sm`}>
            View per-user analytics →
          </Link>
        </div>
      </div>

      <StatSection title="Users" stats={overview.stats.users} />
      <StatSection title="Workspaces" stats={overview.stats.workspaces} />
      <StatSection title="Activity" stats={overview.stats.activity} />
      <StatSection title="WhatsApp" stats={overview.stats.whatsapp} />
      <StatSection title="Memory" stats={overview.stats.memory} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="dashboard-panel">
          <h2 className={ui.sectionTitle}>Recent signups</h2>
          {overview.recentUsers.length === 0 ? (
            <p className={`mt-3 ${ui.mutedText}`}>No users yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60">
              {overview.recentUsers.map((user) => (
                <li
                  key={user.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {user.label ?? "—"}
                    </p>
                    <p className="truncate text-xs text-ink-faint">
                      {user.email ?? user.id}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {user.whatsappConnected ? "WhatsApp connected" : "No WhatsApp"}
                      {user.phone ? ` · ${user.phone}` : ""}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-ink-faint"
                    dateTime={user.createdAt}
                  >
                    {formatWhen(user.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-panel">
          <h2 className={ui.sectionTitle}>Recent workspaces</h2>
          {overview.recentWorkspaces.length === 0 ? (
            <p className={`mt-3 ${ui.mutedText}`}>No workspaces yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60">
              {overview.recentWorkspaces.map((workspace) => (
                <li
                  key={workspace.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/w/${workspace.id}`}
                      className="truncate font-medium text-ink hover:underline"
                    >
                      {workspace.name}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {workspace.memberCount} members · {workspace.taskCount} tasks
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-ink-faint"
                    dateTime={workspace.createdAt}
                  >
                    {formatWhen(workspace.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
