import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError, resolveBatchAwareTaskShortId } from "@/lib/services/project";
import type { ConversationTurn } from "@/lib/services/conversation";
import { WHATSAPP_TOOL_NAMES } from "@/lib/tools/catalog";
import {
  resolveTaskFromBoard,
  type TaskMatchRow,
} from "@/lib/task-title-search";
import {
  formatAmbiguousTaskPick,
  formatTaskPickPrompt,
  taskTitleHintsFromTurns,
  lastTaskShortIdFromTurns,
} from "@/lib/whatsapp-task-context";

/** @deprecated Use WHATSAPP_TOOL_NAMES from lib/tools/catalog — kept for imports. */
export { WHATSAPP_TOOL_NAMES as KNOWN_WHATSAPP_ACTIONS } from "@/lib/tools/catalog";

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

type BoardTaskRow = TaskMatchRow;

async function loadBoardTasks(workspaceId: string): Promise<BoardTaskRow[]> {
  return prisma.task.findMany({
    where: { workspaceId },
    select: { shortId: true, title: true, description: true },
    orderBy: { shortId: "asc" },
  });
}

function resolveFromBoard(board: BoardTaskRow[], titleQuery: string) {
  return resolveTaskFromBoard(board, titleQuery);
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

  const hintQueries = taskTitleHintsFromTurns(session.conversationTurns);
  for (const hint of hintQueries) {
    const matched = resolveFromBoard(board, hint);
    if (matched.kind === "one") {
      return { kind: "one", shortId: matched.shortId };
    }
  }

  const matched = resolveFromBoard(board, session.userMessage.trim());
  if (matched.kind === "one") {
    return { kind: "one", shortId: matched.shortId };
  }
  if (matched.kind === "ambiguous") {
    return { kind: "ambiguous", tasks: matched.tasks };
  }
  return { kind: "none", tasks: matched.tasks };
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
  if (!WHATSAPP_TOOL_NAMES.has(action)) {
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
      // Body comes from the model (required in the schema); the handler
      // asks for it if somehow missing — no NL mining here.
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
    case "create_post": {
      const body = String(input.body ?? "").trim();
      if (!body) {
        return { ok: false, message: "What should the discussion say?" };
      }
      break;
    }
    case "reply_to_post": {
      const discussion = String(input.discussion ?? "").trim();
      const body = String(input.body ?? "").trim();
      if (!discussion) {
        return { ok: false, message: "Which discussion should I reply in?" };
      }
      if (!body) {
        return { ok: false, message: "What should the reply say?" };
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

/** Resolve task by #N or title match for the in-app web chat. */
export async function resolveWebTaskShortId(
  workspaceId: string,
  rawShortId: unknown,
  taskRef: unknown
): Promise<ResolvedTaskShortId> {
  const hinted = parsePositiveInt(rawShortId);
  if (hinted) {
    const onBoard = await prisma.task.findFirst({
      where: { workspaceId, shortId: hinted },
      select: { shortId: true },
    });
    if (onBoard) return { ok: true, shortId: onBoard.shortId };
    return { ok: false, message: `Task #${hinted} wasn't found in this workspace.` };
  }

  const query = typeof taskRef === "string" ? taskRef.trim() : "";
  if (!query) {
    return {
      ok: false,
      message: "Which task? Name the task or give its #N number.",
    };
  }

  const board = await loadBoardTasks(workspaceId);
  const matched = resolveFromBoard(board, query);
  if (matched.kind === "one") {
    return { ok: true, shortId: matched.shortId };
  }
  if (matched.kind === "ambiguous") {
    const lines = matched.tasks
      .slice(0, 5)
      .map((t) => `• ${t.title}`)
      .join("\n");
    return {
      ok: false,
      message: `Multiple tasks could match:\n${lines}\nWhich one did you mean?`,
    };
  }

  return {
    ok: false,
    message: `No task matched "${query}" in this workspace.`,
  };
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
