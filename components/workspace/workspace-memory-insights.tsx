import type { WorkspaceMemoryAnalytics } from "@/lib/services/workspace-analytics";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <div className="text-2xl font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-ink-soft">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div> : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
      {children}
    </h3>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Not yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function CaptureTrend({ daily }: { daily: { day: string; count: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <div className="flex h-24 items-end gap-1">
        {daily.map((d) => (
          <div key={d.day} className="group relative flex flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t bg-ink/80 transition-all group-hover:bg-ink"
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
              title={`${d.day}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
        <span>{daily[0]?.day.slice(5)}</span>
        <span>Memory captured / day (14d)</span>
        <span>{daily[daily.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

function BarList({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-sm text-ink-soft" title={r.label}>
            {r.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full bg-ink/70"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-faint">
            {r.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceMemoryInsights({
  analytics,
}: {
  analytics: WorkspaceMemoryAnalytics;
}) {
  const {
    headline,
    capture,
    blockers,
    curation,
    contributors,
    topics,
    usage,
    documentReviews,
    candidateQuality,
  } = analytics;

  return (
    <div className="flex flex-col gap-6">
      {/* Headline */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Decisions" value={headline.decisions} />
        <Stat label="Open blockers" value={headline.openBlockers} />
        <Stat label="Insights" value={headline.insights} />
        <Stat label="Documents" value={headline.documents} />
        <Stat label="Active memory" value={headline.activeMemory} />
      </div>

      {/* Capture trend */}
      <div>
        <SectionTitle>Capture activity</SectionTitle>
        <CaptureTrend daily={capture.daily} />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Captured (7d)" value={capture.events7d} />
          <Stat label="Captured (30d)" value={capture.events30d} />
          <Stat
            label="From coding agents"
            value={capture.bySource.agent}
            hint="ambient (30d)"
          />
          <Stat
            label="From documents"
            value={capture.bySource.document}
            hint="Markdown (30d)"
          />
          <Stat
            label="From discussions"
            value={capture.bySource.discussion + capture.bySource.taskUpdate}
            hint="posts + updates (30d)"
          />
        </div>
      </div>

      {/* Candidate quality */}
      <div>
        <SectionTitle>Candidate quality (30d)</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Awaiting leader review" value={candidateQuality.pending} />
          <Stat label="Candidates extracted" value={candidateQuality.created30d} />
          <Stat label="Rejected by critic" value={candidateQuality.rejected30d} />
          <Stat label="Promoted" value={candidateQuality.promoted30d} />
          <Stat
            label="Archived by feedback"
            value={candidateQuality.feedbackArchived30d}
          />
        </div>
      </div>

      {/* Document admission */}
      <div>
        <SectionTitle>Document admission (30d)</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
          <Stat label="Documents accepted" value={documentReviews.accepted30d} />
          <Stat label="Documents rejected" value={documentReviews.rejected30d} />
        </div>
        {documentReviews.rejected.length > 0 ? (
          <div className="mt-3 rounded-xl border border-line bg-paper px-4 py-3">
            <p className="mb-3 text-xs font-medium text-ink-soft">
              Recently rejected documents
            </p>
            <ul className="divide-y divide-line/60">
              {documentReviews.rejected.map((document) => (
                <li key={document.path} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className="truncate font-mono text-[11px] text-ink"
                      title={document.path}
                    >
                      {document.path}
                    </span>
                    <span className="text-[11px] text-ink-faint">
                      {document.explicit
                        ? "Explicitly excluded"
                        : new Date(document.reviewedAt).toLocaleDateString(
                            "en-GB",
                            {
                              month: "short",
                              day: "numeric",
                            }
                          )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    {document.reason}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Blocker health */}
      <div>
        <SectionTitle>Blocker health</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Open now" value={blockers.open} />
          <Stat label="Resolved (30d)" value={blockers.resolved30d} />
          <Stat
            label="Median time to resolve"
            value={
              blockers.medianResolutionDays === null
                ? "—"
                : `${blockers.medianResolutionDays}d`
            }
          />
          <Stat
            label="Oldest open"
            value={
              blockers.oldestOpenAgeDays === null
                ? "—"
                : `${blockers.oldestOpenAgeDays}d`
            }
          />
        </div>
        {blockers.oldest.length > 0 ? (
          <div className="mt-3 rounded-xl border border-line bg-paper px-4 py-3">
            <p className="mb-2 text-xs font-medium text-ink-soft">
              Oldest open blockers
            </p>
            <ul className="flex flex-col gap-2">
              {blockers.oldest.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink" title={b.summary}>
                    {b.taskShortId ? (
                      <span className="mr-1 font-mono text-xs text-ink-faint">
                        #{b.taskShortId}
                      </span>
                    ) : null}
                    {b.summary}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">{b.ageDays}d</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Curation health */}
      <div>
        <SectionTitle>Curation health</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Reviewed" value={`${curation.reviewedPct}%`} hint="curated by Dreaming" />
          <Stat label="Awaiting review" value={curation.unreviewed} />
          <Stat label="Deduped / superseded" value={curation.superseded} />
          <Stat label="Dream runs (30d)" value={curation.dreamRuns30d} />
          <Stat label="Merged (30d)" value={curation.merged30d} />
          <Stat label="Insights (30d)" value={curation.insights30d} />
          <Stat label="Archived (30d)" value={curation.archived30d} />
          <Stat
            label="Last curated"
            value={formatWhen(curation.lastDream?.at ?? null)}
            hint={
              curation.lastDream
                ? `${curation.lastDream.merged} merged · ${curation.lastDream.insights} insights`
                : undefined
            }
          />
        </div>
      </div>

      {/* Contributors + topics */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <SectionTitle>Top contributors</SectionTitle>
          {contributors.length > 0 ? (
            <BarList rows={contributors} />
          ) : (
            <p className="text-sm text-ink-faint">No contributors yet.</p>
          )}
        </div>
        <div>
          <SectionTitle>Top topics</SectionTitle>
          {topics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1 rounded-full bg-paper-deep px-2.5 py-1 text-xs font-medium text-ink-soft"
                >
                  #{t.label}
                  <span className="text-ink-faint">{t.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-faint">No tags yet.</p>
          )}
        </div>
      </div>

      {/* Usage */}
      <div>
        <SectionTitle>Memory usage (30d)</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Recall queries" value={usage.recall30d} />
          <Stat label="Context pulls" value={usage.contextPull30d} />
          <Stat label="Agent briefs served" value={usage.briefs30d} />
          <Stat
            label="Average brief"
            value={`~${Math.round(usage.briefAvgChars / 4).toLocaleString()}`}
            hint="estimated tokens"
          />
          <Stat label="Connected agents" value={usage.agentSeats} />
        </div>
      </div>
    </div>
  );
}
