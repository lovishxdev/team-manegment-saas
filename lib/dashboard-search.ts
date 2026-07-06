import { rankTasksByTitleQuery } from "@/lib/task-title-search";
import type { DashboardSearchTask } from "@/lib/services/workspace";

const STATUS_KEYWORDS: { phrase: string; status: DashboardSearchTask["status"] }[] =
  [
    { phrase: "in progress", status: "IN_PROGRESS" },
    { phrase: "in-progress", status: "IN_PROGRESS" },
    { phrase: "progress", status: "IN_PROGRESS" },
    { phrase: "to do", status: "TODO" },
    { phrase: "todo", status: "TODO" },
    { phrase: "done", status: "DONE" },
  ];

const STATUS_LABELS: Record<DashboardSearchTask["status"], string> = {
  TODO: "to do",
  IN_PROGRESS: "in progress",
  DONE: "done",
};

function matchesStatus(task: DashboardSearchTask, query: string): boolean {
  const label = STATUS_LABELS[task.status];
  if (label.includes(query)) return true;
  if (task.status.toLowerCase().replace("_", " ").includes(query)) return true;
  return STATUS_KEYWORDS.some(
    (entry) => entry.status === task.status && query.includes(entry.phrase)
  );
}

function matchesAssignees(task: DashboardSearchTask, query: string): boolean {
  return task.assignees.some((assignee) =>
    (assignee.label ?? "").toLowerCase().includes(query)
  );
}

export function matchesDashboardSearchQuery(
  task: DashboardSearchTask,
  rawQuery: string
): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return false;

  if (task.title.toLowerCase().includes(query)) return true;
  if (`#${task.shortId}`.includes(query)) return true;
  if (task.workspaceName.toLowerCase().includes(query)) return true;
  if (matchesStatus(task, query)) return true;
  if (matchesAssignees(task, query)) return true;

  return false;
}

export function filterDashboardSearchTasks(
  tasks: DashboardSearchTask[],
  rawQuery: string
): DashboardSearchTask[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const matched = tasks.filter((task) => matchesDashboardSearchQuery(task, query));
  const titleRanked = rankTasksByTitleQuery(
    query,
    matched.map((task) => ({
      ...task,
      description: null as string | null,
    })),
    0.2
  );
  const rankedIds = new Set(titleRanked.map((task) => task.id));
  const rest = matched.filter((task) => !rankedIds.has(task.id));

  return [...titleRanked, ...rest].slice(0, 25);
}

export function filterDashboardWorkspaces<
  T extends { workspace: { id: string; name: string } },
>(workspaces: T[], rawQuery: string, matchingTaskWorkspaceIds: Set<string>): T[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return workspaces;

  return workspaces.filter(
    (entry) =>
      matchingTaskWorkspaceIds.has(entry.workspace.id) ||
      entry.workspace.name.toLowerCase().includes(query)
  );
}
