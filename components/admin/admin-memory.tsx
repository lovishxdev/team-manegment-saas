import type {
  AdminMemoryAnalytics,
  AdminMemoryStat,
} from "@/lib/services/admin-memory";
import { ui } from "@/components/ui/ui";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function StatCard({ stat }: { stat: AdminMemoryStat }) {
  return (
    <div className="rounded-xl border border-line/70 bg-paper/90 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {stat.label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {stat.value}
      </p>
      {stat.hint ? (
        <p className="mt-1 text-xs text-ink-faint">{stat.hint}</p>
      ) : null}
    </div>
  );
}

function StatSection({
  title,
  stats,
}: {
  title: string;
  stats: AdminMemoryStat[];
}) {
  return (
    <section>
      <h2 className={ui.sectionTitle}>{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-faint";
const td = "px-3 py-2 text-sm tabular-nums text-ink";

export function AdminMemory({ analytics }: { analytics: AdminMemoryAnalytics }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className={ui.pageTitle}>Memory</h1>
        <p className={ui.pageSubtitle}>
          Capture precision, recall usage, and context token economy.
          Generated {formatWhen(analytics.generatedAt)}.
        </p>
      </div>

      <StatSection title="Capture funnel (7d)" stats={analytics.capture} />
      <StatSection title="Recall & resolution (7d)" stats={analytics.recall} />
      <StatSection title="Dreaming (7d)" stats={analytics.dreaming} />
      <StatSection title="Token economy" stats={analytics.tokens} />

      <section className="dashboard-panel">
        <h2 className={ui.sectionTitle}>Last 14 days</h2>
        {analytics.days.length === 0 ? (
          <p className={`mt-3 ${ui.mutedText}`}>
            No metrics yet — counters start accumulating as the pipeline runs.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-line/70">
                  <th className={th}>Day</th>
                  <th className={th}>Judge runs</th>
                  <th className={th}>Events</th>
                  <th className={th}>Dupes blocked</th>
                  <th className={th}>Recalls</th>
                  <th className={th}>Context pulls</th>
                  <th className={th}>Asks</th>
                  <th className={th}>Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {analytics.days.map((day) => (
                  <tr key={day.day}>
                    <td className={`${td} whitespace-nowrap`}>{day.day}</td>
                    <td className={td}>{day.judgeRuns}</td>
                    <td className={td}>{day.eventsCreated}</td>
                    <td className={td}>{day.duplicatesSkipped}</td>
                    <td className={td}>{day.recalls}</td>
                    <td className={td}>{day.contextPulls}</td>
                    <td className={td}>{day.resolutionAsks}</td>
                    <td className={td}>{day.resolutionsConfirmed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <h2 className={ui.sectionTitle}>Recent dream runs</h2>
        {analytics.dreamRuns.length === 0 ? (
          <p className={`mt-3 ${ui.mutedText}`}>
            No dream runs yet — the nightly cron (or{" "}
            <code className="rounded bg-paper-deep px-1 py-0.5 font-mono text-[11px]">
              npm run dream:memory
            </code>
            ) will populate this.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line/70">
                  <th className={th}>When</th>
                  <th className={th}>Workspace</th>
                  <th className={th}>Reviewed</th>
                  <th className={th}>Merged</th>
                  <th className={th}>Superseded</th>
                  <th className={th}>Insights</th>
                  <th className={th}>Archived</th>
                  <th className={th}>Duration</th>
                  <th className={th}>Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {analytics.dreamRuns.map((run) => (
                  <tr key={run.id}>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatWhen(run.createdAt)}
                    </td>
                    <td className={`${td} max-w-[160px] truncate font-medium`}>
                      {run.workspaceName}
                    </td>
                    <td className={td}>{run.reviewed}</td>
                    <td className={td}>{run.merged}</td>
                    <td className={td}>{run.superseded}</td>
                    <td className={td}>{run.insights}</td>
                    <td className={td}>{run.archived}</td>
                    <td className={td}>
                      {(run.durationMs / 1000).toFixed(1)}s
                    </td>
                    <td className={`${td} max-w-[220px] truncate text-ink-faint`}>
                      {run.skipped ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <h2 className={ui.sectionTitle}>Per workspace</h2>
        {analytics.workspaces.length === 0 ? (
          <p className={`mt-3 ${ui.mutedText}`}>No memory events yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line/70">
                  <th className={th}>Workspace</th>
                  <th className={th}>Events</th>
                  <th className={th}>Open</th>
                  <th className={th}>Decisions</th>
                  <th className={th}>Documents</th>
                  <th className={th}>Superseded</th>
                  <th className={th}>New (7d)</th>
                  <th className={th}>Brief tokens</th>
                  <th className={th}>Raw history tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {analytics.workspaces.map((ws) => (
                  <tr key={ws.id}>
                    <td className={`${td} max-w-[220px] truncate font-medium`}>
                      {ws.name}
                    </td>
                    <td className={td}>{ws.totalEvents}</td>
                    <td className={td}>{ws.openBlockers}</td>
                    <td className={td}>{ws.decisions}</td>
                    <td className={td}>{ws.documents}</td>
                    <td className={td}>{ws.superseded}</td>
                    <td className={td}>{ws.events7d}</td>
                    <td className={td}>
                      {ws.briefTokens !== null
                        ? `~${ws.briefTokens.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className={td}>
                      ~{ws.rawHistoryTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
