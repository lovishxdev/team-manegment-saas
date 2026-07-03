import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError, resolveBatchAwareTaskShortId } from "@/lib/services/project";
import type { ConversationTurn } from "@/lib/services/conversation";
import {
  rankTasksByTitleQuery,
  scoreTaskTitleQuery,
} from "@/lib/task-title-search";
import {
  formatAmbiguousTaskPick,
  formatTaskPickPrompt,
  isProgressReport,
  resolveTaskUpdateBody,
  taskTitleHintsFromTurns,
  lastTaskShortIdFromTurns,
} from "@/lib/whatsapp-task-context";

/** Every tool Haiku may call on WhatsApp — reject unknown names early. */
export const KNOWN_WHATSAPP_ACTIONS = new Set([
  "create_workspace",
  "list_workspaces",
  "switch_workspace",
  "create_task",
  "update_task",
  "read_task",
  "add_task_update",
  "list_task_updates",
  "delete_task",
  "get_board_state",
  "rename_workspace",
  "list_assets",
  "attach_asset_to_task",
  "add_link",
  "list_links",
  "show_workspace_picker",
  "update_asset_tags",
  "invite_members",
  "list_workspace_members",
  "create_invite_link",
  "promote_member",
  "demote_member",
  "list_my_tasks",
  "ask_task",
  "find_task",
  "search_tasks",
  "workspace_summary",
  "read_asset",
  "delete_asset",
  "delete_link",
  "update_link",
  "pin_link",
  "remove_member",
  "list_categories",
  "create_category",
  "leave_workspace",
  "bulk_update_tasks",
  "unassign_task",
  "export_whiteboard",
]);

export type WhatsAppToolSession = {
  userMessage: string;
  conversationTurns: ConversationTurn[];
  lastDiscussedTaskShortId: number | null;
  createdTaskShortIds: number[];
};

export type ToolPreflight =
  | { ok: true }
  | { ok: false; message: string };

export function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function resolveShortIdHint(
  raw: unknown,
  session: WhatsAppToolSession
): number | null {
  return (
    parsePositiveInt(raw) ??
    session.lastDiscussedTaskShortId ??
    lastTaskShortIdFromTurns(session.conversationTurns)
  );
}

type BoardTaskRow = {
  shortId: number;
  title: string;
  description: string | null;
};

async function loadBoardTasks(workspaceId: string): Promise<BoardTaskRow[]> {
  return prisma.task.findMany({
    where: { workspaceId },
    select: { shortId: true, title: true, description: true },
    orderBy: { shortId: "asc" },
  });
}

/** Match task by name from the user's message or recent chat context. */
async function matchTaskFromContext(
  workspaceId: string,
  session: WhatsAppToolSession
): Promise<
  | { kind: "one"; shortId: number }
  | { kind: "ambiguous"; tasks: { title: string }[] }
  | { kind: "none"; tasks: { title: string }[] }
> {
  const board = await loadBoardTasks(workspaceId);
  if (board.length === 0) {
    return { kind: "none", tasks: [] };
  }

  if (isProgressReport(session.userMessage)) {
    const fromHistory = resolveShortIdHint(undefined, session);
    if (fromHistory) {
      const hit = board.find((t) => t.shortId === fromHistory);
      if (hit) return { kind: "one", shortId: fromHistory };
    }
  }

  const queries = [
    session.userMessage.trim(),
    ...taskTitleHintsFromTurns(session.conversationTurns),
  ].filter((q) => q.length >= 2);

  let best: { shortId: number; score: number } | null = null;

  for (const query of queries) {
    for (const task of board) {
      const score = scoreTaskTitleQuery(query, task.title, task.description);
      if (score < 0.38) continue;
      if (!best || score > best.score) {
        best = { shortId: task.shortId, score };
      }
    }
  }

  if (!best) {
    return {
      kind: "none",
      tasks: board.map((t) => ({ title: t.title })),
    };
  }

  const userQuery = session.userMessage.trim();
  if (userQuery.length >= 2) {
    const ranked = rankTasksByTitleQuery(userQuery, board, 0.38);
    if (ranked.length >= 2) {
      const top = scoreTaskTitleQuery(
        userQuery,
        ranked[0].title,
        ranked[0].description
      );
      const runner = scoreTaskTitleQuery(
        userQuery,
        ranked[1].title,
        ranked[1].description
      );
      if (Math.abs(top - runner) < 0.12) {
        return {
          kind: "ambiguous",
          tasks: ranked.slice(0, 3).map((t) => ({ title: t.title })),
        };
      }
    }
  }

  return { kind: "one", shortId: best.shortId };
}

/**
 * Pre-execution validation — never let malformed tool args reach Prisma.
 * Task identity is resolved later by name/number (not blocked here).
 */
export function validateWhatsAppToolInput(
  action: string,
  input: Record<string, unknown>,
  session: WhatsAppToolSession
): ToolPreflight {
  if (!KNOWN_WHATSAPP_ACTIONS.has(action)) {
    return {
      ok: false,
      message:
        "I don't know how to do that yet. Try creating a task, updating one, or asking about the board.",
    };
  }

  switch (action) {
    case "create_workspace": {
      const name = String(input.name ?? "").trim();
      if (!name) {
        return { ok: false, message: "What should the new workspace be called?" };
      }
      break;
    }
    case "create_task": {
      const title = String(input.title ?? "").trim();
      if (!title) {
        return { ok: false, message: "What should the task be called?" };
      }
      break;
    }
    case "switch_workspace": {
      const name = String(input.workspace ?? input.name ?? "").trim();
      if (!name) {
        return { ok: false, message: "Which workspace should I switch to?" };
      }
      break;
    }
    case "rename_workspace": {
      const name = String(input.name ?? "").trim();
      if (!name) {
        return { ok: false, message: "What should the workspace be renamed to?" };
      }
      break;
    }
    case "add_task_update": {
      const body = resolveTaskUpdateBody(
        input.body,
        session.userMessage,
        session.conversationTurns
      );
      if (!body) {
        return { ok: false, message: "What should the note say?" };
      }
      break;
    }
    case "ask_task": {
      const query = String(input.query ?? "").trim();
      if (!query) {
        return { ok: false, message: "What would you like to know about the task?" };
      }
      break;
    }
    case "find_task": {
      const query = String(input.query ?? "").trim();
      if (!query) {
        return { ok: false, message: "What task should I look for?" };
      }
      break;
    }
    case "add_link": {
      const url = String(input.url ?? "").trim();
      if (!url) {
        return { ok: false, message: "Send me the URL to save." };
      }
      break;
    }
  }

  return { ok: true };
}

export type ResolvedTaskShortId =
  | { ok: true; shortId: number }
  | { ok: false; message: string };

/** Resolve task by number, recent context, or title match — user never sees #N jargon. */
export async function resolveWhatsAppTaskShortId(
  workspaceId: string,
  raw: unknown,
  session: WhatsAppToolSession
): Promise<ResolvedTaskShortId> {
  let hinted = resolveShortIdHint(raw, session);

  if (!hinted) {
    const matched = await matchTaskFromContext(workspaceId, session);
    if (matched.kind === "one") {
      hinted = matched.shortId;
    } else if (matched.kind === "ambiguous") {
      return { ok: false, message: formatAmbiguousTaskPick(matched.tasks) };
    } else {
      return {
        ok: false,
        message: formatTaskPickPrompt(matched.tasks),
      };
    }
  }

  const shortId = await resolveBatchAwareTaskShortId(
    workspaceId,
    hinted,
    session.createdTaskShortIds
  );

  if (!Number.isInteger(shortId) || shortId < 1) {
    const board = await loadBoardTasks(workspaceId);
    return {
      ok: false,
      message: formatTaskPickPrompt(
        board.map((t) => ({ title: t.title })),
        "I couldn't find that one."
      ),
    };
  }

  const onBoard = await prisma.task.findFirst({
    where: { workspaceId, shortId },
    select: { shortId: true, title: true },
  });

  if (!onBoard) {
    const board = await loadBoardTasks(workspaceId);
    return {
      ok: false,
      message: formatTaskPickPrompt(
        board.map((t) => ({ title: t.title })),
        "I couldn't find that task."
      ),
    };
  }

  return { ok: true, shortId };
}

/** Map server errors to safe WhatsApp copy — never leak stack traces or 500s. */
export function formatToolExecutionError(err: unknown): string {
  if (err instanceof ServiceError) {
    if (err.code === "NO_WORKSPACE") {
      return 'You need a workspace first. Say: "create a workspace called My Team"';
    }
    if (/^Task #\d+ not found/i.test(err.message)) {
      return "I couldn't find that task on your board.";
    }
    return err.message;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error("[whatsapp] prisma validation:", err.message);
    return "That didn't go through — try naming the task and I'll retry.";
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return "I couldn't find that — it may have been deleted.";
    }
    console.error("[whatsapp] prisma error:", err.code, err.message);
    return "Something went wrong saving that. Try again in a moment.";
  }

  console.error("[whatsapp] tool execution error:", err);
  return "Something went wrong on that action. Try again in a moment.";
}
