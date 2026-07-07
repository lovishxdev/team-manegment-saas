const TASK_RETURN_KEY = "euclis:task-return";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export function taskNewPath(
  workspaceId: string,
  options?: { status?: TaskStatus }
): string {
  const base = `/w/${workspaceId}/tasks/new`;
  if (!options?.status || options.status === "TODO") return base;
  return `${base}?status=${options.status}`;
}

export function parseTaskStatusParam(
  value: string | undefined
): TaskStatus | undefined {
  if (value === "TODO" || value === "IN_PROGRESS" || value === "DONE") {
    return value;
  }
  return undefined;
}

export function taskPath(
  workspaceId: string,
  shortId: number,
  options?: { tab?: "updates" | "memory" }
): string {
  const base = `/w/${workspaceId}/tasks/${shortId}`;
  if (options?.tab) return `${base}?tab=${options.tab}`;
  return base;
}

export function parseTaskTabParam(
  value: string | undefined
): "updates" | "memory" | undefined {
  if (value === "updates" || value === "memory") return value;
  return undefined;
}

export function isTaskPath(pathname: string): boolean {
  return /\/w\/[^/]+\/tasks(\/|$)/.test(pathname);
}

/** Call before navigating to a task page so back returns here. */
export function rememberTaskReturnPath(pathname: string): void {
  if (typeof window === "undefined" || isTaskPath(pathname)) return;
  sessionStorage.setItem(TASK_RETURN_KEY, pathname);
}

/** Destination when leaving a task page (clears stored path). */
export function consumeTaskReturnPath(workspaceId: string): string {
  if (typeof window === "undefined") return `/w/${workspaceId}`;
  const path = sessionStorage.getItem(TASK_RETURN_KEY);
  sessionStorage.removeItem(TASK_RETURN_KEY);
  if (path && !isTaskPath(path)) return path;
  return `/w/${workspaceId}`;
}
