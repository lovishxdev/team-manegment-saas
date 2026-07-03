import type { ConversationTurn } from "@/lib/services/conversation";
import type { ActionOutcome } from "@/lib/channel-formatters";
import {
  createTask,
  getBoardState,
  resolveUserWorkspaceContext,
  updateTask,
} from "@/lib/services/project";
import { runAddTaskUpdate } from "@/lib/bot/extended-tools";
import {
  formatBoardState,
  mapBoardSnapshot,
} from "@/lib/channel-formatters";
import {
  resolveTaskUpdateBody,
} from "@/lib/whatsapp-task-context";
import { resolveWhatsAppTaskShortId } from "@/lib/whatsapp-tool-guard";
import { classifyActionOutcome } from "@/lib/whatsapp-action-outcome";
import { humanizeToolMessage } from "@/lib/whatsapp-voice";
import type { TriageResult } from "@/lib/whatsapp-orchestrator/types";
import { revalidateUserWorkspaces } from "@/lib/revalidate-nav";

export type SimpleExecuteInput = {
  userId: string;
  userMessage: string;
  turns: ConversationTurn[];
  lastDiscussedTaskShortId: number | null;
  triage: TriageResult;
  session?: {
    lastCreatedTask: { shortId: number; workspaceId: string; title: string } | null;
    createdTaskShortIds: number[];
    lastDiscussedTaskShortId: number | null;
  };
};

export type SimpleExecuteOutput = {
  reply: string;
  actionResults: ActionOutcome[];
};

function sessionFrom(input: SimpleExecuteInput) {
  return {
    userMessage: input.userMessage,
    conversationTurns: input.turns,
    lastDiscussedTaskShortId: input.lastDiscussedTaskShortId,
    createdTaskShortIds: [] as number[],
  };
}

/**
 * Step 2a — deterministic execution for high-confidence simple intents.
 * No second LLM call; tools + formatters only.
 */
export async function executeSimpleIntent(
  input: SimpleExecuteInput
): Promise<SimpleExecuteOutput | null> {
  const { triage, userId, userMessage } = input;
  const slots = triage.slots ?? {};
  const ctx = await resolveUserWorkspaceContext(userId);
  const session = sessionFrom(input);
  const outcomes: ActionOutcome[] = [];

  try {
    switch (triage.intent) {
      case "board_list": {
        const state = await getBoardState(ctx.workspaceId, userId);
        const msg = formatBoardState(
          {
            workspaceId: ctx.workspaceId,
            workspaceName: ctx.workspaceName,
            board: mapBoardSnapshot(state.board),
            totalTasks: state.totalTasks,
          },
          "whatsapp"
        );
        outcomes.push(classifyActionOutcome("get_board_state", msg));
        return { reply: msg, actionResults: outcomes };
      }

      case "create_task": {
        const title =
          slots.title?.trim() ||
          userMessage.replace(/^(add|create)\s+(a\s+)?task\s*/i, "").trim();
        if (!title) return null;
        const task = await createTask({
          workspaceId: ctx.workspaceId,
          title,
          userId,
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        if (input.session) {
          input.session.lastCreatedTask = {
            shortId: task.shortId,
            workspaceId: ctx.workspaceId,
            title: task.title,
          };
          input.session.createdTaskShortIds.push(task.shortId);
        }
        const raw = `Created *${task.title}*`;
        outcomes.push(classifyActionOutcome("create_task", raw));
        return {
          reply: humanizeToolMessage("create_task", raw),
          actionResults: outcomes,
        };
      }

      case "post_update": {
        const body =
          slots.body?.trim() ||
          resolveTaskUpdateBody("", userMessage, input.turns);
        if (!body) return null;

        const resolved = await resolveWhatsAppTaskShortId(
          ctx.workspaceId,
          undefined,
          session
        );
        if (!resolved.ok) return null;

        const raw = await runAddTaskUpdate(
          { workspaceId: ctx.workspaceId, workspaceName: ctx.workspaceName },
          userId,
          resolved.shortId,
          body,
          "whatsapp"
        );
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        if (input.session) {
          input.session.lastDiscussedTaskShortId = resolved.shortId;
        }
        outcomes.push(classifyActionOutcome("add_task_update", raw));
        return {
          reply: humanizeToolMessage("add_task_update", raw),
          actionResults: outcomes,
        };
      }

      case "update_task": {
        const resolved = await resolveWhatsAppTaskShortId(
          ctx.workspaceId,
          undefined,
          session
        );
        if (!resolved.ok) return null;

        const status =
          slots.status ??
          (/\bdone\b|completed|finished/i.test(userMessage)
            ? "DONE"
            : /\bstart|in progress|working on/i.test(userMessage)
              ? "IN_PROGRESS"
              : undefined);
        if (!status) return null;

        const task = await updateTask({
          workspaceId: ctx.workspaceId,
          shortId: resolved.shortId,
          userId,
          status,
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        const statusLabel =
          task.status === "DONE"
            ? "done"
            : task.status === "IN_PROGRESS"
              ? "in progress"
              : "to do";
        const raw = `Updated *${task.title}* → ${statusLabel}.`;
        outcomes.push(classifyActionOutcome("update_task", raw));
        return {
          reply: humanizeToolMessage("update_task", raw),
          actionResults: outcomes,
        };
      }

      default:
        return null;
    }
  } catch (err) {
    console.error("[orchestrator] simple execute failed:", err);
    return null;
  }
}
