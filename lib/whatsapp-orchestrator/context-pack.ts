import type { ConversationTurn } from "@/lib/services/conversation";
import {
  lastTaskShortIdFromTurns,
  taskTitleHintsFromTurns,
} from "@/lib/whatsapp-task-context";
import { prisma } from "@/lib/prisma";

export type BoardTaskSummary = {
  shortId: number;
  title: string;
  status: string;
  priority: string;
};

export type OrchestratorContextPack = {
  user_message: string;
  workspace_name: string | null;
  workspace_id: string | null;
  today: string;
  weekday: string;
  recent_turns: Array<{ role: string; content: string }>;
  board_tasks: BoardTaskSummary[];
  last_discussed_task_short_id: number | null;
  task_title_hints: string[];
  pending_flags: {
    delete_confirm: boolean;
    workspace_picker: boolean;
  };
};

export async function buildOrchestratorContext(input: {
  userMessage: string;
  workspaceId: string | null;
  workspaceName: string | null;
  turns: ConversationTurn[];
  lastDiscussedTaskShortId: number | null;
  pendingDelete?: boolean;
  workspacePickerPending?: boolean;
}): Promise<OrchestratorContextPack> {
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });

  let board_tasks: BoardTaskSummary[] = [];
  if (input.workspaceId) {
    const rows = await prisma.task.findMany({
      where: { workspaceId: input.workspaceId },
      select: { shortId: true, title: true, status: true, priority: true },
      orderBy: { shortId: "asc" },
      take: 40,
    });
    board_tasks = rows;
  }

  const recent = input.turns.slice(-8).map((t) => ({
    role: t.role,
    content: t.content.slice(0, 600),
  }));

  return {
    user_message: input.userMessage,
    workspace_name: input.workspaceName,
    workspace_id: input.workspaceId,
    today,
    weekday,
    recent_turns: recent,
    board_tasks,
    last_discussed_task_short_id:
      input.lastDiscussedTaskShortId ??
      lastTaskShortIdFromTurns(input.turns),
    task_title_hints: taskTitleHintsFromTurns(input.turns).slice(0, 6),
    pending_flags: {
      delete_confirm: Boolean(input.pendingDelete),
      workspace_picker: Boolean(input.workspacePickerPending),
    },
  };
}

/** Compact string for triage/judge prompts — rich but token-efficient. */
export function formatContextForPrompt(pack: OrchestratorContextPack): string {
  const board =
    pack.board_tasks.length === 0
      ? "(empty board)"
      : pack.board_tasks
          .map(
            (t) =>
              `- #${t.shortId} ${t.title} [${t.status.replace("_", " ")}, ${t.priority}]`
          )
          .join("\n");

  const turns =
    pack.recent_turns.length === 0
      ? "(no prior messages)"
      : pack.recent_turns
          .map((t) => `${t.role}: ${t.content}`)
          .join("\n---\n");

  return (
    `Today: ${pack.weekday}, ${pack.today}\n` +
    `Workspace: ${pack.workspace_name ?? "(none)"}\n` +
    `Last discussed task #${pack.last_discussed_task_short_id ?? "?"} ` +
    `(hints: ${pack.task_title_hints.join(", ") || "none"})\n` +
    `Pending: delete=${pack.pending_flags.delete_confirm}, picker=${pack.pending_flags.workspace_picker}\n\n` +
    `Board:\n${board}\n\n` +
    `Recent chat:\n${turns}\n\n` +
    `Current user message:\n${pack.user_message}`
  );
}
