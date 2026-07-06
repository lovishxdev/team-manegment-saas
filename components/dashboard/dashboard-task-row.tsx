import Link from "next/link";
import type { DashboardTaskPeek } from "@/lib/services/workspace";

const STATUS_STYLES: Record<DashboardTaskPeek["status"], string> = {
  TODO: "bg-rose-50 text-rose-700",
  IN_PROGRESS: "bg-orange-50 text-orange-700",
  DONE: "bg-violet-50 text-violet-700",
};

const STATUS_LABELS: Record<DashboardTaskPeek["status"], string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

function formatDue(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
}

export function DashboardTaskRow({
  task,
  showAssignees = false,
}: {
  task: DashboardTaskPeek & {
    assignees?: { id: string; label: string | null }[];
  };
  showAssignees?: boolean;
}) {
  const assigneeLabel =
    showAssignees && task.assignees && task.assignees.length > 0
      ? task.assignees
          .map((assignee) => assignee.label)
          .filter(Boolean)
          .join(", ")
      : null;

  return (
    <Link
      href={`/w/${task.workspaceId}?task=${task.shortId}`}
      className="group flex items-center gap-3 rounded-lg border border-line/70 bg-paper/80 px-3 py-2.5 transition hover:border-line-strong hover:bg-paper hover:shadow-sm"
    >
      <span
        className={`inline-flex w-[5.75rem] shrink-0 justify-center rounded px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLES[task.status]}`}
      >
        {STATUS_LABELS[task.status]}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {task.title}
      </span>
      {assigneeLabel ? (
        <span className="hidden shrink-0 max-w-[8rem] truncate text-xs text-ink-faint md:inline">
          {assigneeLabel}
        </span>
      ) : null}
      <span className="hidden shrink-0 text-xs text-ink-faint sm:inline">
        {task.workspaceName}
      </span>
      {task.dueDate ? (
        <span className="shrink-0 font-mono text-[11px] text-ink-faint">
          {formatDue(task.dueDate)}
        </span>
      ) : null}
    </Link>
  );
}
