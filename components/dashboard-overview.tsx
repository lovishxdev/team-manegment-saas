function Sparkline({ tone }: { tone: "up" | "down" }) {
  const stroke = tone === "up" ? "#22c55e" : "#f87171";
  const fill = tone === "up" ? "rgba(34,197,94,0.12)" : "rgba(248,113,113,0.12)";
  const points =
    tone === "up"
      ? "2,28 12,22 22,24 32,14 42,16 52,8 62,10 72,4 78,6"
      : "2,8 12,12 22,10 32,18 42,16 52,22 62,20 72,26 78,24";

  return (
    <svg viewBox="0 0 80 32" className="h-10 w-24 shrink-0" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`${points} 78,32 2,32`}
        fill={fill}
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5 text-ink-faint"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M6.2 6a1.8 1.8 0 0 1 3.5.8c0 1.2-1.8 1.4-1.8 2.6M8 11.8v.2" />
    </svg>
  );
}

function MetricIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f0f0f0] text-ink-faint">
      {children}
    </span>
  );
}

export function OverviewStatCard({
  label,
  value,
  trend,
  trendLabel,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  trendLabel: string;
  tone: "up" | "down";
}) {
  const trendCls =
    tone === "up"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-red-50 text-red-500";

  return (
    <div className="flex flex-1 flex-col px-8 py-8 sm:px-10 sm:py-10">
      <MetricIcon>
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.4">
          <circle cx="10" cy="10" r="7" />
          <path d="M10 6v4l2.5 2.5" />
        </svg>
      </MetricIcon>

      <div className="flex items-center gap-1.5 text-sm text-ink-soft">
        <span>{label}</span>
        <HelpIcon />
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-semibold tracking-tight text-ink sm:text-[2.75rem] sm:leading-none">
            {value}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${trendCls}`}
            >
              {tone === "up" ? "↑" : "↓"} {trend}
            </span>
            <span className="text-xs text-ink-faint">{trendLabel}</span>
          </div>
        </div>
        <Sparkline tone={tone} />
      </div>
    </div>
  );
}

export function OverviewCard({
  openTasks,
  totalMembers,
  doneTasks,
}: {
  openTasks: number;
  totalMembers: number;
  doneTasks: number;
}) {
  const completionRate =
    openTasks + doneTasks > 0
      ? Math.round((doneTasks / (openTasks + doneTasks)) * 100)
      : 0;

  return (
    <section className="rounded-2xl bg-paper shadow-sm">
      <p className="px-6 pt-6 text-lg font-semibold text-ink sm:px-8">Overview</p>
      <div className="mt-2 flex flex-col divide-y divide-line/70 sm:flex-row sm:divide-x sm:divide-y-0">
        <OverviewStatCard
          label="Open tasks"
          value={String(openTasks)}
          trend={`${Math.min(completionRate + 12, 99)}%`}
          trendLabel="across workspaces"
          tone="up"
        />
        <OverviewStatCard
          label="Team members"
          value={String(totalMembers)}
          trend={`${Math.max(totalMembers, 1)}`}
          trendLabel="people collaborating"
          tone={totalMembers > 0 ? "up" : "down"}
        />
      </div>
    </section>
  );
}
