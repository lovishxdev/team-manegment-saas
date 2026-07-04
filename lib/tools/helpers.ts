import { z } from "zod";

/** Shared Zod params (same text the MCP connector has always shown). */
export const workspaceParam = z
  .string()
  .optional()
  .describe(
    "Workspace name, only if the user explicitly mentioned one. Omit to use the active workspace."
  );

export const dueDateParam = z
  .string()
  .optional()
  .describe(
    "Due date as YYYY-MM-DD. Resolve relative dates (e.g. 'Friday') to a concrete date before calling."
  );

export const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

/** Coerce unknown input to a trimmed string ("" when absent). */
export function str(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function optionalStr(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value);
  return s ? s : undefined;
}

export function optionalNum(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseInputDueDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "") return null;
  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseTagsInput(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.map((t) => String(t).trim()).filter(Boolean);
}

/** "me" (any case) resolves to the sender; otherwise pass through. */
export function resolveAssigneeInput(
  value: unknown,
  senderUserId: string
): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (s === "") return null;
  if (s.toLowerCase() === "me") return senderUserId;
  return s;
}

export function resolveAssigneesHints(
  assignees: unknown,
  assignee: unknown,
  senderUserId: string
): string[] | undefined {
  if (Array.isArray(assignees)) {
    const hints: string[] = [];
    for (const raw of assignees) {
      const resolved = resolveAssigneeInput(raw, senderUserId);
      if (resolved) hints.push(resolved);
    }
    return hints;
  }
  const single = resolveAssigneeInput(assignee, senderUserId);
  if (single === undefined) return undefined;
  if (single === null) return [];
  return [single];
}

export function resolveAssigneesUpdate(
  assignees: unknown,
  assignee: unknown,
  senderUserId: string
): string[] | null | undefined {
  if (assignees !== undefined) {
    if (!Array.isArray(assignees)) return undefined;
    if (assignees.length === 0) return [];
    const hints: string[] = [];
    for (const raw of assignees) {
      const resolved = resolveAssigneeInput(raw, senderUserId);
      if (resolved) hints.push(resolved);
    }
    return hints;
  }
  if (assignee !== undefined) {
    const single = resolveAssigneeInput(assignee, senderUserId);
    if (single === null) return [];
    if (single) return [single];
    return [];
  }
  return undefined;
}
