import type { ConversationTurn } from "@/lib/services/conversation";
import { runAddTaskUpdate } from "@/lib/bot/extended-tools";
import { resolveUserWorkspaceContext } from "@/lib/services/project";
import {
  isAffirmationOnly,
  isProgressReport,
  lastTaskShortIdFromTurns,
  resolveTaskUpdateBody,
  taskTitleHintsFromTurns,
} from "@/lib/whatsapp-task-context";
import { humanizeToolMessage } from "@/lib/whatsapp-voice";
import { resolveWhatsAppTaskShortId } from "@/lib/whatsapp-tool-guard";
import { scoreTaskTitleQuery } from "@/lib/task-title-search";
import { prisma } from "@/lib/prisma";

export { isProgressReport } from "@/lib/whatsapp-task-context";

export function isPostConfirmation(text: string): boolean {
  const t = text.trim();
  if (!isAffirmationOnly(t)) return false;
  return /\bpost\b/i.test(t) || /^yes\b/i.test(t);
}

async function resolveTaskForFastPath(
  workspaceId: string,
  userMessage: string,
  turns: ConversationTurn[],
  lastDiscussedTaskShortId: number | null
): Promise<number | null> {
  const session = {
    userMessage,
    conversationTurns: turns,
    lastDiscussedTaskShortId,
    createdTaskShortIds: [] as number[],
  };

  const resolved = await resolveWhatsAppTaskShortId(
    workspaceId,
    undefined,
    session
  );
  if (resolved.ok) return resolved.shortId;

  const fromHistory =
    lastDiscussedTaskShortId ?? lastTaskShortIdFromTurns(turns);
  if (fromHistory) return fromHistory;

  const board = await prisma.task.findMany({
    where: { workspaceId },
    select: { shortId: true, title: true, description: true },
  });
  const hints = taskTitleHintsFromTurns(turns);
  let best: { shortId: number; score: number } | null = null;
  for (const hint of hints) {
    for (const task of board) {
      const score = scoreTaskTitleQuery(hint, task.title, task.description);
      if (score < 0.38) continue;
      if (!best || score > best.score) best = { shortId: task.shortId, score };
    }
  }
  return best?.shortId ?? null;
}

/**
 * Skip Haiku for obvious progress notes / post confirmations when task context exists.
 */
export async function tryFastPathTaskUpdate(input: {
  userId: string;
  userMessage: string;
  turns: ConversationTurn[];
  lastDiscussedTaskShortId: number | null;
}): Promise<string | null> {
  const text = input.userMessage.trim();
  if (!text) return null;

  const wantsPost =
    isProgressReport(text) ||
    isPostConfirmation(text) ||
    (isAffirmationOnly(text) && resolveTaskUpdateBody("", text, input.turns));

  if (!wantsPost) return null;

  const body = resolveTaskUpdateBody("", text, input.turns);
  if (!body) return null;

  const ctx = await resolveUserWorkspaceContext(input.userId);
  const shortId = await resolveTaskForFastPath(
    ctx.workspaceId,
    text,
    input.turns,
    input.lastDiscussedTaskShortId
  );
  if (!shortId) return null;

  const raw = await runAddTaskUpdate(
    { workspaceId: ctx.workspaceId, workspaceName: ctx.workspaceName },
    input.userId,
    shortId,
    body,
    "whatsapp"
  );
  return humanizeToolMessage("add_task_update", raw);
}
