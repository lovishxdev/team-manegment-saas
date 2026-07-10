import { prisma } from "@/lib/prisma";
import {
  listMemoryEvents,
  type MemoryEventRow,
} from "@/lib/services/memory";

/**
 * The ambient project brief: a compact markdown snapshot of what the next
 * coding-agent session should know — open blockers, current decisions,
 * active tasks. The stop hook writes it to .cursor/rules/euclis-memory.mdc
 * (alwaysApply), so every new session is born context-aware with zero tool
 * calls. get_project_context remains the on-demand, query-scoped deep pull.
 */

const MAX_TASKS = 12;
const MAX_DECISIONS = 8;
const MAX_BLOCKERS = 10;
const MAX_RECENT = 6;
const MAX_INSIGHTS = 3;

const STATUS_LABEL: Record<string, string> = {
  TODO: "todo",
  IN_PROGRESS: "in progress",
  DONE: "done",
};

function formatEventLine(e: MemoryEventRow): string {
  const task = e.task ? ` · task #${e.task.shortId}` : "";
  const tags =
    e.tags.length > 0 ? ` · ${e.tags.map((t) => `#${t}`).join(" ")}` : "";
  const why = e.reasoning ? `\n  why: ${e.reasoning}` : "";
  return `- [${e.kind}] ${e.summary}${why}\n  (${e.createdAt.toISOString().slice(0, 10)}${task}${tags} · id: ${e.id})`;
}

export async function buildWorkspaceBrief(input: {
  workspaceId: string;
  workspaceName: string;
  userId: string;
}): Promise<string> {
  const [tasks, openEvents, decisions, insights, recent] = await Promise.all([
    prisma.task.findMany({
      where: { workspaceId: input.workspaceId, status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      take: MAX_TASKS,
      select: {
        shortId: true,
        title: true,
        status: true,
        assignees: { select: { user: { select: { username: true } } } },
      },
    }),
    listMemoryEvents({
      workspaceId: input.workspaceId,
      userId: input.userId,
      status: "OPEN",
      limit: MAX_BLOCKERS,
    }),
    listMemoryEvents({
      workspaceId: input.workspaceId,
      userId: input.userId,
      kind: "DECISION",
      limit: MAX_DECISIONS,
    }),
    // Dream-cycle patterns — cross-event observations no single session saw.
    listMemoryEvents({
      workspaceId: input.workspaceId,
      userId: input.userId,
      kind: "INSIGHT",
      limit: MAX_INSIGHTS,
    }),
    // What just happened, regardless of kind/status — resolved blockers and
    // fresh milestones included, so a returning agent sees movement at a
    // glance without querying anything.
    prisma.memoryEvent.findMany({
      where: {
        workspaceId: input.workspaceId,
        supersededByEventId: null,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT,
      select: {
        kind: true,
        status: true,
        summary: true,
        createdAt: true,
      },
    }),
  ]);

  const sections: string[] = [
    `# Euclis project memory — ${input.workspaceName}`,
    ``,
    `Live brief from Euclis (source of truth for tasks, decisions, blockers).`,
    `Auto-refreshed after each agent run — do not edit by hand.`,
  ];

  sections.push(``, `## Open blockers & dependencies`);
  sections.push(
    openEvents.length > 0
      ? openEvents.map(formatEventLine).join("\n")
      : `(none)`
  );

  sections.push(``, `## Current decisions`);
  sections.push(
    decisions.length > 0
      ? decisions.map(formatEventLine).join("\n")
      : `(none recorded yet)`
  );

  if (insights.length > 0) {
    sections.push(``, `## Patterns & insights`);
    sections.push(insights.map(formatEventLine).join("\n"));
  }

  sections.push(``, `## Recent memory activity`);
  sections.push(
    recent.length > 0
      ? recent
          .map((e) => {
            const statusNote =
              (e.kind === "BLOCKER" || e.kind === "DEPENDENCY") &&
              e.status === "RESOLVED"
                ? ", resolved"
                : "";
            return `- [${e.kind}${statusNote}] ${e.summary} (${e.createdAt.toISOString().slice(0, 10)})`;
          })
          .join("\n")
      : `(nothing yet)`
  );

  sections.push(``, `## Active tasks`);
  sections.push(
    tasks.length > 0
      ? tasks
          .map((t) => {
            const who = t.assignees
              .map((a) => `@${a.user.username}`)
              .join(", ");
            return `- #${t.shortId} ${t.title} (${STATUS_LABEL[t.status] ?? t.status}${who ? ` — ${who}` : ""})`;
          })
          .join("\n")
      : `(none)`
  );

  sections.push(
    ``,
    `## Working with Euclis`,
    `- If a blocker above affects the current work, tell the user before proceeding.`,
    `- Deeper context on demand: \`get_project_context\` / \`recall_memory\` (Euclis MCP).`,
    `- After meaningful work: \`add_task_update\` on the task (#N). New decisions: \`record_decision\`.`,
    `- \`resolve_blocker\` only after the user confirms a blocker is actually cleared.`,
    `- Commits for a Euclis task should reference it in the message (e.g. "(#12)" in the subject).`
  );

  return sections.join("\n");
}
