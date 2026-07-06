"use client";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting({
  userLabel,
  workspaceCount,
  openTasks,
  assignedToYou,
}: {
  userLabel: string | null;
  workspaceCount: number;
  openTasks: number;
  assignedToYou: number;
}) {
  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const name = userLabel ?? "there";

  const stats: string[] = [];
  if (workspaceCount > 0) {
    stats.push(
      `${workspaceCount} workspace${workspaceCount === 1 ? "" : "s"}`
    );
  }
  if (openTasks > 0) {
    stats.push(`${openTasks} open task${openTasks === 1 ? "" : "s"}`);
  }
  if (assignedToYou > 0) {
    stats.push(
      `${assignedToYou} assigned to you`
    );
  }

  return (
    <header className="mb-6">
      <h1 className="text-[2.192rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.577rem]">
        {greeting}, {name}
      </h1>
      {stats.length > 0 ? (
        <p className="mt-1.5 font-mono text-[13px] text-ink-soft">
          {stats.join(" · ")}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink-soft">
          Your workspaces will show up below once you create or join one.
        </p>
      )}
    </header>
  );
}
