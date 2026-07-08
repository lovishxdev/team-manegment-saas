import { z } from "zod";
import type { TaskPriority, TaskStatus } from "@/lib/generated/prisma/client";
import {
  createTask,
  getBoardState,
  getTask,
  updateTask,
} from "@/lib/services/project";
import { getRecentTaskUpdates } from "@/lib/services/task-updates";
import {
  runAddTaskUpdate,
  runAskTask,
  runBulkUpdateTasks,
  runFindTask,
  runListMyTasks,
  runListTaskUpdates,
  runSearchTasks,
  runUnassignTask,
  MAX_BULK_TASK_UPDATES,
} from "@/lib/bot/extended-tools";
import {
  formatBoardState,
  formatTaskDetail,
  mapBoardSnapshot,
} from "@/lib/channel-formatters";
import { resolveWhatsAppTaskShortId, resolveWebTaskShortId } from "@/lib/whatsapp-tool-guard";
import { formatChatDate } from "@/lib/whatsapp-voice";
import { displayUser } from "@/lib/username";
import {
  buildTaskSnapshot,
  recordUndoable,
  undoLastAction,
} from "@/lib/services/action-log";
import { stageDeleteTask } from "@/lib/whatsapp-pending";
import { deleteTask } from "@/lib/services/project";
import { revalidateUserWorkspaces } from "@/lib/revalidate-nav";
import { workspaceUrl } from "@/lib/app-url";
import { waWebhookLog } from "@/lib/whatsapp-webhook-log";
import {
  noteDiscussedTask,
  notePostedUpdate,
} from "@/lib/whatsapp-cache";
import {
  ok,
  soft,
  requireWorkspace,
  type ToolContext,
  type ToolDef,
} from "@/lib/tools/types";
import {
  PRIORITIES,
  STATUSES,
  dueDateParam,
  optionalNum,
  optionalStr,
  parseInputDueDate,
  parseMentionRefsInput,
  parseTagsInput,
  resolveAssigneesHints,
  resolveAssigneesUpdate,
  str,
  workspaceParam,
} from "@/lib/tools/helpers";
import { getOpenBlockersForTaskShortId } from "@/lib/services/memory";
import { formatMemoryEvents } from "@/lib/tools/defs/memory";
import { formatOpenBlockerNudge } from "@/lib/memory/suggest";

/**
 * Passive alerting: any agent touching a task sees its open blockers at the
 * moment they're relevant (MCP is pull-based — there is no push channel).
 * Returns "" when the task has none.
 */
async function openBlockerSection(
  workspaceId: string,
  shortId: number
): Promise<string> {
  const blockers = await getOpenBlockersForTaskShortId(workspaceId, shortId);
  if (blockers.length === 0) return "";
  return `\n\n⛔ Open blockers on this task:\n${formatMemoryEvents(blockers)}`;
}

/**
 * On WhatsApp the model rarely knows #N — resolve from the message, chat
 * context, or board titles. On MCP the client always passes shortId.
 */
async function resolveShortIdForChannel(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ ok: true; shortId: number } | { ok: false; message: string }> {
  const ws = requireWorkspace(ctx);
  if (ctx.wa) {
    return resolveWhatsAppTaskShortId(ws.workspaceId, input.shortId, ctx.wa.session);
  }
  if (ctx.channel === "web") {
    return resolveWebTaskShortId(ws.workspaceId, input.shortId, input.taskRef);
  }
  const shortId = Number(input.shortId);
  if (!Number.isInteger(shortId) || shortId < 1) {
    return { ok: false, message: "A valid task shortId (#N) is required." };
  }
  return { ok: true, shortId };
}

const createTaskTool: ToolDef = {
  name: "create_task",
  waDescription: "Create a new task on the user's project board",
  mcpDescription: "Create a new task on the project board",
  inputShape: {
    title: z
      .string()
      .min(1)
      .describe(
        "Short task title only (brief label, ideally under 80 characters)"
      ),
    description: z
      .string()
      .optional()
      .describe(
        "Longer details: bullet lists, paragraphs, requirements, keywords — put lengthy content here, not in title"
      ),
    category: z
      .string()
      .optional()
      .describe(
        "Task category (e.g. Marketing, Backend). Creates a custom category if needed. Only if clearly implied."
      ),
    priority: z
      .enum(PRIORITIES)
      .optional()
      .describe("Priority, only if stated or strongly implied"),
    dueDate: dueDateParam,
    tags: z
      .array(z.string())
      .optional()
      .describe("Free-form labels, e.g. marketing, v2"),
    assignee: z
      .string()
      .optional()
      .describe(
        "Single assignee: 'me' for the sender, or a member @username from list_workspace_members (with or without @)"
      ),
    assignees: z
      .array(z.string())
      .optional()
      .describe(
        "Multiple assignees: 'me', @usernames, or handles shown in list_workspace_members"
      ),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const task = await createTask({
      workspaceId: ws.workspaceId,
      title: str(input.title),
      description: optionalStr(input.description),
      category: optionalStr(input.category),
      priority: input.priority as TaskPriority | undefined,
      dueDate: parseInputDueDate(input.dueDate),
      tags: parseTagsInput(input.tags),
      assignees: resolveAssigneesHints(input.assignees, input.assignee, ctx.userId),
      userId: ctx.userId,
    });

    if (ctx.wa) {
      const session = ctx.wa.session;
      session.createdTaskShortIds.push(task.shortId);
      session.lastCreatedTask = {
        shortId: task.shortId,
        workspaceId: ws.workspaceId,
        title: task.title,
      };
      noteDiscussedTask(session, task.shortId, task.title);
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
      waWebhookLog("task created", {
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        shortId: task.shortId,
      });
      const hints = [
        task.priority === "HIGH" ? "high priority" : "",
        task.dueDate ? `due ${formatChatDate(task.dueDate)}` : "",
        task.assignees.length > 0
          ? `assigned to ${task.assignees.map((a) => `@${displayUser(a.user)}`).join(", ")}`
          : "",
      ].filter(Boolean);
      const message = `Added *${task.title}*${hints.length ? ` (${hints.join(", ")})` : ""}.`;
      recordUndoable({
        userId: ctx.userId,
        workspaceId: ws.workspaceId,
        channel: "whatsapp",
        tool: "create_task",
        summary: message,
        inverse: { kind: "delete_task", taskId: task.id, taskTitle: task.title },
      });
      return ok(message, { shortId: task.shortId, title: task.title });
    }

    recordUndoable({
      userId: ctx.userId,
      workspaceId: ws.workspaceId,
      channel: "mcp",
      tool: "create_task",
      summary: `Created task #${task.shortId} "${task.title}"`,
      inverse: { kind: "delete_task", taskId: task.id, taskTitle: task.title },
    });
    return ok(
      `Created task #${task.shortId} "${task.title}" (${task.category.name}, ${task.priority}` +
        (task.dueDate
          ? `, due ${task.dueDate.toISOString().slice(0, 10)}`
          : "") +
        `) in workspace "${ws.workspaceName}".`,
      { shortId: task.shortId, title: task.title }
    );
  },
};

const updateTaskTool: ToolDef = {
  name: "update_task",
  waDescription:
    "Change any fields of an existing task referenced by its #N short ID. Only include fields the user wants changed.",
  mcpDescription:
    "Update any fields of an existing task, identified by its short ID (the #N number on the board). Only provided fields change.",
  webDescription:
    "Update a task — identify it by #N or taskRef (task name). Only include fields the user wants changed.",
  inputShape: {
    shortId: z.number().int().positive().describe("Task short ID (the N in #N)"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    status: z.enum(STATUSES).optional().describe("New status"),
    category: z
      .string()
      .optional()
      .describe("New category name (creates it if missing)"),
    priority: z.enum(PRIORITIES).optional().describe("New priority"),
    dueDate: z
      .string()
      .optional()
      .describe(
        "Due date as YYYY-MM-DD (resolve relative dates first), or empty string to clear"
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe("Full replacement list of free-form labels"),
    assignee: z
      .string()
      .optional()
      .describe(
        "Single assignee: 'me', a member name/email, or empty string to clear all assignees"
      ),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Full replacement list of assignees"),
    workspace: workspaceParam,
  },
  webInputShape: {
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Task #N if known"),
    taskRef: z
      .string()
      .optional()
      .describe(
        "Task name or phrase to identify the task — e.g. 'login page redesign'. Use when shortId is unknown."
      ),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    status: z.enum(STATUSES).optional().describe("New status"),
    category: z
      .string()
      .optional()
      .describe("New category name (creates it if missing)"),
    priority: z.enum(PRIORITIES).optional().describe("New priority"),
    dueDate: z
      .string()
      .optional()
      .describe(
        "Due date as YYYY-MM-DD (resolve relative dates first), or empty string to clear"
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe("Full replacement list of free-form labels"),
    assignee: z
      .string()
      .optional()
      .describe(
        "Single assignee: 'me', a member name/email, or empty string to clear all assignees"
      ),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Full replacement list of assignees"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const resolved = await resolveShortIdForChannel(input, ctx);
    if (!resolved.ok) return soft(resolved.message);

    // Snapshot the fields about to change so "undo that" can restore them.
    const before = await getTask(ws.workspaceId, ctx.userId, resolved.shortId);
    const prevSnapshot = buildTaskSnapshot(
      {
        title: before.title,
        description: before.description,
        status: before.status,
        priority: before.priority,
        dueDate: before.dueDate,
        tags: before.tags,
        categoryId: before.categoryId,
        assigneeIds: before.assignees.map((a) => a.userId),
      },
      input
    );

    const assigneeUpdate = resolveAssigneesUpdate(
      input.assignees,
      input.assignee,
      ctx.userId
    );
    const task = await updateTask({
      workspaceId: ws.workspaceId,
      shortId: resolved.shortId,
      userId: ctx.userId,
      title: optionalStr(input.title),
      description: optionalStr(input.description),
      status: input.status as TaskStatus | undefined,
      category: optionalStr(input.category),
      priority: input.priority as TaskPriority | undefined,
      dueDate: parseInputDueDate(input.dueDate),
      tags: parseTagsInput(input.tags),
      assignees: assigneeUpdate === undefined ? undefined : assigneeUpdate,
    });

    if (ctx.wa) {
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
      noteDiscussedTask(ctx.wa.session, task.shortId, task.title);
      const statusLabel =
        task.status === "DONE"
          ? "done"
          : task.status === "IN_PROGRESS"
            ? "in progress"
            : "to do";
      const message = `Updated *${task.title}* → ${statusLabel}.`;
      recordUndoable({
        userId: ctx.userId,
        workspaceId: ws.workspaceId,
        channel: "whatsapp",
        tool: "update_task",
        summary: message,
        inverse: {
          kind: "restore_task",
          taskId: task.id,
          taskTitle: task.title,
          prev: prevSnapshot,
        },
      });
      return ok(message, {
        shortId: task.shortId,
        status: task.status,
      });
    }

    if (ctx.channel === "web") {
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
      const newTitle = optionalStr(input.title);
      const message = newTitle
        ? `Renamed **${before.title}** → **${task.title}**.`
        : `Updated **${task.title}**.`;
      recordUndoable({
        userId: ctx.userId,
        workspaceId: ws.workspaceId,
        channel: "mcp",
        tool: "update_task",
        summary: message,
        inverse: {
          kind: "restore_task",
          taskId: task.id,
          taskTitle: task.title,
          prev: prevSnapshot,
        },
      });
      return ok(message, { shortId: task.shortId, title: task.title });
    }

    recordUndoable({
      userId: ctx.userId,
      workspaceId: ws.workspaceId,
      channel: "mcp",
      tool: "update_task",
      summary: `Updated task #${task.shortId} "${task.title}"`,
      inverse: {
        kind: "restore_task",
        taskId: task.id,
        taskTitle: task.title,
        prev: prevSnapshot,
      },
    });

    return ok(
      `Updated task #${task.shortId} "${task.title}": ${task.status}, ${task.category.name}, ${task.priority}` +
        (task.dueDate
          ? `, due ${task.dueDate.toISOString().slice(0, 10)}`
          : "") +
        ` (workspace "${ws.workspaceName}").`,
      { shortId: task.shortId, status: task.status }
    );
  },
};

const readTaskTool: ToolDef = {
  name: "read_task",
  waDescription:
    "Get full details for one task by #N short ID. Use when the user asks about a task or a specific field (tags, assignees, due date, status, description, etc.).",
  mcpDescription:
    "Get full details for one task by short ID (#N). Use when the user asks about a task or a specific field (tags, assignees, due date, status, description, priority, category, attachments). Answer only what they asked unless they wanted everything.",
  inputShape: {
    shortId: z.number().int().positive().describe("Task short ID (the N in #N)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const resolved = await resolveShortIdForChannel(input, ctx);
    if (!resolved.ok) return soft(resolved.message);

    const [task, recentUpdates, blockerSection] = await Promise.all([
      getTask(ws.workspaceId, ctx.userId, resolved.shortId),
      getRecentTaskUpdates(ws.workspaceId, ctx.userId, resolved.shortId),
      openBlockerSection(ws.workspaceId, resolved.shortId),
    ]);
    return ok(
      formatTaskDetail(task, ws.workspaceName, ws.workspaceId, ctx.channel, recentUpdates) +
        blockerSection,
      { shortId: task.shortId, title: task.title }
    );
  },
};

const mentionRefsParam = z
  .array(z.string())
  .optional()
  .describe(
    "Teammates the user is calling out or asking — workspace handles from list_workspace_members, without @. Use when they name someone in natural language ('tell gvvhbb31…', 'blocked waiting on sarvikiitd', 'ask lovish to review') even if body has no @."
  );

const addTaskUpdateTool: ToolDef = {
  name: "add_task_update",
  waDescription:
    "Post a progress note on a task. Use when the user reports status, progress, or blockers ('I started…', 'just uploaded the files', 'blocked on X') or confirms posting something you offered. ALWAYS pass body (their words). When they name or address a teammate, pass mentions[] with handles from list_workspace_members — users won't type @ on WhatsApp.",
  mcpDescription:
    "Post a team update on a task (#N) — blockers, questions, review notes. Not for editing the task description. Pass mentions[] when the user tags or addresses teammates by name.",
  inputShape: {
    shortId: z.number().int().positive().describe("Task short ID (#N)"),
    body: z.string().min(1).describe("Update message"),
    mentions: mentionRefsParam,
    workspace: workspaceParam,
  },
  waInputShape: {
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Task short ID if known. Omit when the task was just discussed — it will be inferred."
      ),
    body: z
      .string()
      .min(1)
      .describe(
        "The update text — the user's words verbatim, or the exact text you offered if they confirmed posting it."
      ),
    mentions: mentionRefsParam,
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const resolved = await resolveShortIdForChannel(input, ctx);
    if (!resolved.ok) return soft(resolved.message);

    const body = str(input.body);
    if (!body) {
      return soft(
        "What should the note say? Reply with the text and I'll post it."
      );
    }

    const posted = await runAddTaskUpdate(
      ws,
      ctx.userId,
      resolved.shortId,
      body,
      ctx.channel,
      { mentionRefs: parseMentionRefsInput(input.mentions) }
    );
    recordUndoable({
      userId: ctx.userId,
      workspaceId: ws.workspaceId,
      channel: ctx.wa ? "whatsapp" : "mcp",
      tool: "add_task_update",
      summary: posted.message,
      inverse: {
        kind: "delete_update",
        updateId: posted.updateId,
        taskTitle: posted.taskTitle,
      },
    });
    if (ctx.wa) {
      ctx.wa.session.lastDiscussedTaskShortId = resolved.shortId;
      noteDiscussedTask(ctx.wa.session, resolved.shortId, posted.taskTitle);
      notePostedUpdate(
        ctx.wa.session,
        resolved.shortId,
        posted.taskTitle,
        body
      );
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
      return ok(posted.message, { shortId: resolved.shortId });
    }

    // MCP is pull-based: if this task has open blockers, ride the response
    // the agent was already getting with a confirm-first resolution nudge.
    const openBlockers = await getOpenBlockersForTaskShortId(
      ws.workspaceId,
      resolved.shortId
    );
    return ok(posted.message + formatOpenBlockerNudge(openBlockers), {
      shortId: resolved.shortId,
    });
  },
};

const listTaskUpdatesTool: ToolDef = {
  name: "list_task_updates",
  waDescription:
    "List all team updates on a task (#N) — blockers, questions, and follow-ups. Use when the user asks what's happening or pending on a task.",
  mcpDescription:
    "List team updates on a task (#N) — blockers, questions, follow-ups. Use when the user asks what's happening or pending on a task.",
  inputShape: {
    shortId: z.number().int().positive().describe("Task short ID (#N)"),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe("Max updates to return (default 50)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const resolved = await resolveShortIdForChannel(input, ctx);
    if (!resolved.ok) return soft(resolved.message);
    const message = await runListTaskUpdates(
      ws,
      ctx.userId,
      resolved.shortId,
      ctx.channel,
      optionalNum(input.limit)
    );
    return ok(message, { shortId: resolved.shortId });
  },
};

const deleteTaskTool: ToolDef = {
  name: "delete_task",
  waDescription:
    "Permanently delete a task referenced by its #N short ID. Only when the user clearly asks for deletion.",
  mcpDescription:
    "Permanently delete a task by short ID (#N). ALWAYS call once without confirm to preview, show the user what will be deleted, and ask them to confirm. Only call again with confirm=true after explicit user confirmation.",
  inputShape: {
    shortId: z.number().int().positive().describe("Task short ID (#N)"),
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Set true only after the user explicitly confirms deletion in chat"
      ),
    workspace: workspaceParam,
  },
  waInputShape: {
    shortId: z.number().int().positive().describe("Task short ID (the N in #N)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const resolved = await resolveShortIdForChannel(input, ctx);
    if (!resolved.ok) return soft(resolved.message);

    const existing = await getTask(ws.workspaceId, ctx.userId, resolved.shortId);

    if (ctx.wa) {
      // WhatsApp stages a Confirm/Cancel button flow instead of confirm=true.
      await stageDeleteTask(ctx.wa.session.phone, ctx.userId, {
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        shortId: resolved.shortId,
        taskTitle: existing.title,
      });
      ctx.wa.session.pendingDeleteShortId = resolved.shortId;
      return ok(
        `I'll delete *${existing.title}* — tap Confirm below.`,
        { staged: true, shortId: resolved.shortId }
      );
    }

    if (input.confirm !== true) {
      return ok(
        `Delete task #${existing.shortId} "${existing.title}" from workspace "${ws.workspaceName}"?\n\n` +
          `This cannot be undone. Ask the user to confirm, then call delete_task again with confirm=true.`,
        { staged: true, shortId: existing.shortId }
      );
    }

    const task = await deleteTask({
      workspaceId: ws.workspaceId,
      shortId: resolved.shortId,
      userId: ctx.userId,
    });
    return ok(
      `Deleted task #${task.shortId} "${task.title}" from workspace "${ws.workspaceName}".`,
      { shortId: task.shortId }
    );
  },
};

const getBoardStateTool: ToolDef = {
  name: "get_board_state",
  waDescription: "Get all tasks on the board grouped by status",
  mcpDescription: "Get the current project board: all tasks grouped by status",
  inputShape: {
    workspace: workspaceParam,
  },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const state = await getBoardState(ws.workspaceId, ctx.userId);
    const body = formatBoardState(
      {
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        board: mapBoardSnapshot(state.board),
        totalTasks: state.totalTasks,
      },
      ctx.channel
    );
    if (ctx.channel === "mcp") {
      return ok(`${body}\n\nOpen: ${workspaceUrl(ws.workspaceId)}`);
    }
    return ok(body);
  },
};

const listMyTasksTool: ToolDef = {
  name: "list_my_tasks",
  waDescription: "List open tasks assigned to the user",
  inputShape: {
    status: z
      .string()
      .optional()
      .describe(
        "Filter: TODO, IN_PROGRESS, DONE, or OPEN (todo + in progress). Default OPEN."
      ),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    return ok(await runListMyTasks(ws, ctx.userId, input, ctx.channel));
  },
};

const askTaskTool: ToolDef = {
  name: "ask_task",
  waDescription:
    "Answer questions about a task: finds the task by description or #N, then includes the full update thread. Use for 'what's going on', 'what's wrong with X flow', status questions.",
  mcpDescription:
    "Answer questions about a task: semantic task match + full update thread. Best for status and 'what's wrong with X' questions.",
  inputShape: {
    query: z
      .string()
      .min(1)
      .describe("The user's question or topic (e.g. Sign up with Google flow)"),
    shortId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Task #N if the user gave a number"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const query = str(input.query);
    if (!query) return soft("What would you like to know about the task?");
    const shortId = optionalNum(input.shortId);

    const message = await runAskTask(ws, ctx.userId, { query, shortId }, ctx.channel);

    const idMatch = message.match(/#(\d+)/);
    const resolvedShortId = idMatch ? Number(idMatch[1]) : shortId;

    if (ctx.wa && resolvedShortId !== undefined) {
      const titleMatch = message.match(/\*([^*]+)\*/);
      const title = titleMatch?.[1]?.trim() || `task #${resolvedShortId}`;
      noteDiscussedTask(ctx.wa.session, resolvedShortId, title);
      ctx.wa.session.lastDiscussedTaskShortId = resolvedShortId;
    }

    const blockerSection =
      resolvedShortId !== undefined
        ? await openBlockerSection(ws.workspaceId, resolvedShortId)
        : "";
    return ok(message + blockerSection);
  },
};

const findTaskTool: ToolDef = {
  name: "find_task",
  waDescription:
    "Find a task by natural language (semantic + keyword). Use when the user describes a task without #N — e.g. product features, flows, or vague titles.",
  mcpDescription:
    "Find a task by natural language (semantic + keyword). Use when the user describes a task without #N.",
  inputShape: {
    query: z
      .string()
      .min(1)
      .describe("What the user said — feature name, flow, or task topic"),
    limit: z
      .number()
      .int()
      .positive()
      .max(10)
      .optional()
      .describe("Max matches to return (default 3)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const query = str(input.query);
    if (!query) return soft("What task should I look for?");
    return ok(
      await runFindTask(ws, ctx.userId, query, ctx.channel, optionalNum(input.limit))
    );
  },
};

const searchTasksTool: ToolDef = {
  name: "search_tasks",
  waDescription:
    "Search/filter tasks by title, tag, category, status, assignee, priority, or due date",
  mcpDescription:
    "Search tasks by title, tag, category, status, assignee, priority, or due date",
  inputShape: {
    query: z.string().optional().describe("Search title or description"),
    tag: z.string().optional().describe("Exact tag label"),
    category: z.string().optional().describe("Category name"),
    status: z.string().optional().describe("TODO, IN_PROGRESS, DONE, or OPEN"),
    assignee: z.string().optional().describe("Username or email of assignee"),
    priority: z.enum(PRIORITIES).optional(),
    dueBefore: z.string().optional().describe("Due on or before YYYY-MM-DD"),
    dueAfter: z.string().optional().describe("Due on or after YYYY-MM-DD"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    return ok(await runSearchTasks(ws, ctx.userId, input, ctx.channel));
  },
};

const bulkUpdateTasksTool: ToolDef = {
  name: "bulk_update_tasks",
  waDescription: `Update many tasks at once (max ${MAX_BULK_TASK_UPDATES}). Select by shortIds, shortId range, category, tag, or assignee.`,
  mcpDescription: `Update many tasks at once (max ${MAX_BULK_TASK_UPDATES}). Select by shortIds, range, category, tag, or assignee.`,
  inputShape: {
    shortIds: z
      .array(z.number().int().positive())
      .optional()
      .describe("Task short IDs (#N) to update"),
    shortIdFrom: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Range start (inclusive), e.g. 1 for #1–#4 with shortIdTo 4"),
    shortIdTo: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Range end (inclusive)"),
    category: z.string().optional().describe("Only tasks in this category"),
    tag: z.string().optional().describe("Only tasks with this tag"),
    assignee: z
      .string()
      .optional()
      .describe("Only tasks assigned to this member"),
    assignedToMe: z
      .boolean()
      .optional()
      .describe("Only tasks assigned to the sender"),
    status: z.enum(STATUSES).optional().describe("New status to set"),
    newCategory: z.string().optional().describe("Move tasks to this category"),
    priority: z.enum(PRIORITIES).optional().describe("New priority"),
    clearAssignees: z
      .boolean()
      .optional()
      .describe("Remove all assignees from matched tasks"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const message = await runBulkUpdateTasks(ws, ctx.userId, input, ctx.channel);
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    return ok(message);
  },
};

const unassignTaskTool: ToolDef = {
  name: "unassign_task",
  waDescription: "Remove all assignees from a task (#N)",
  inputShape: {
    shortId: z.number().int().positive().describe("Task short ID (#N)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const resolved = await resolveShortIdForChannel(input, ctx);
    if (!resolved.ok) return soft(resolved.message);
    const message = await runUnassignTask(
      ws,
      ctx.userId,
      resolved.shortId,
      ctx.channel
    );
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    return ok(message);
  },
};

const undoLastActionTool: ToolDef = {
  name: "undo_last_action",
  waDescription:
    "Undo the most recent change I made in this chat (task created or edited, note posted, link saved). Use when the user says undo, revert, or that the last change was a mistake. Repeat to undo earlier changes.",
  mcpDescription:
    "Undo the caller's most recent bot-made change in this workspace (task created/edited, update posted, link saved). Only reverts changes from the last hour.",
  inputShape: {
    workspace: workspaceParam,
  },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const result = await undoLastAction(ctx.userId, ws.workspaceId);
    if (ctx.wa && result.ok) {
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    }
    return result.ok ? ok(result.message) : soft(result.message);
  },
};

export const taskTools: ToolDef[] = [
  undoLastActionTool,
  createTaskTool,
  updateTaskTool,
  readTaskTool,
  addTaskUpdateTool,
  listTaskUpdatesTool,
  deleteTaskTool,
  getBoardStateTool,
  listMyTasksTool,
  askTaskTool,
  findTaskTool,
  searchTasksTool,
  bulkUpdateTasksTool,
  unassignTaskTool,
];
