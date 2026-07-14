import type {
  AdminAIAnalytics,
  AIUsageRollup,
} from "@/lib/services/admin-ai";
import { ui } from "@/components/ui/ui";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-paper/90 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

function UsageTable({
  title,
  rows,
}: {
  title: string;
  rows: AIUsageRollup[];
}) {
  return (
    <section className="dashboard-panel">
      <h2 className={ui.sectionTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={`mt-3 ${ui.mutedText}`}>No usage yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line/70 text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Calls</th>
                <th className="px-3 py-2">Input</th>
                <th className="px-3 py-2">Output</th>
                <th className="px-3 py-2">Cache read</th>
                <th className="px-3 py-2">Saved</th>
                <th className="px-3 py-2">Avg latency</th>
                <th className="px-3 py-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-medium text-ink">{row.label}</td>
                  <td className="px-3 py-2 tabular-nums">{row.calls}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.inputTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.outputTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.cacheReadTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.tokensSaved.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {(row.averageLatencyMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    ${row.estimatedCostUsd.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AdminAIUsage({
  analytics,
}: {
  analytics: AdminAIAnalytics;
}) {
  const summary = analytics.summary;
  return (
    <div className="space-y-8">
      <div>
        <h1 className={ui.pageTitle}>AI usage</h1>
        <p className={ui.pageSubtitle}>
          Internal provider usage, estimated COGS, latency and conservative
          context-token savings. No prompts or response content are stored.
        </p>
      </div>

      <section>
        <h2 className={ui.sectionTitle}>Summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Calls (24h)" value={summary.calls1d.toLocaleString()} />
          <Stat label="Calls (7d)" value={summary.calls7d.toLocaleString()} />
          <Stat
            label="Estimated cost (7d)"
            value={`$${summary.estimatedCost7d.toFixed(3)}`}
          />
          <Stat
            label="Estimated cost (30d)"
            value={`$${summary.estimatedCost30d.toFixed(3)}`}
          />
          <Stat
            label="Tokens used (30d)"
            value={summary.tokens30d.toLocaleString()}
          />
          <Stat
            label="Tokens avoided (30d)"
            value={summary.tokensSaved30d.toLocaleString()}
            hint="Only defensible retrieval-compression baselines"
          />
          <Stat
            label="Errors (30d)"
            value={summary.errors30d.toLocaleString()}
          />
          <Stat
            label="Cost today"
            value={`$${summary.estimatedCost1d.toFixed(3)}`}
          />
        </div>
      </section>

      <UsageTable title="By feature · 30 days" rows={analytics.byFeature} />
      <UsageTable title="By model · 30 days" rows={analytics.byModel} />
      <UsageTable title="By workspace · 30 days" rows={analytics.byWorkspace} />
      <UsageTable title="By user · 30 days" rows={analytics.byUser} />
    </div>
  );
}
