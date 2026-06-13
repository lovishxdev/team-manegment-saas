import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  TaskPriority,
  TaskScope,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import { getUserIdByPhone } from "@/lib/identity-cache";
import {
  createTask,
  deleteTask,
  getBoardState,
  resolveUserWorkspaceContext,
  ServiceError,
  updateTask,
  uploadAsset,
} from "@/lib/services/project";
import {
  getRecentConversation,
  recordExchange,
} from "@/lib/services/conversation";
import { findOrCreateWorkspaceByName } from "@/lib/services/workspace";
import { revalidateUserWorkspaces } from "@/lib/revalidate-nav";
import {
  claimInboundMessage,
  pruneInboundDedup,
} from "@/lib/whatsapp-inbound";
import { WhatsAppProgress } from "@/lib/whatsapp-progress";
import {
  enqueueInboundMessage,
  ensureQueueProcessed,
  recoverStuckQueue,
  touchProcessorLock,
} from "@/lib/whatsapp-queue";
import {
  downloadWhatsAppMedia,
  extractInboundMessage,
  markWhatsAppRead,
  sendWhatsAppText,
  verifyMetaSignature,
  type InboundMessage,
} from "@/lib/whatsapp";

/**
 * WhatsApp bot interface (Meta Cloud API webhook).
 *
 * Flow: signature check -> phone lookup -> Claude Haiku with native tool-use
 * extracts the intended action -> service layer executes -> confirmation
 * text sent back via Graph API.
 */

// claude-3-5-haiku reached end-of-life; Haiku 4.5 is the current fast model.
const HAIKU_MODEL = "claude-haiku-4-5";

const DENIED_MESSAGE =
  "This WhatsApp number isn't linked to an account. If you want to use the bot, sign in to the web app and add this number under Settings → WhatsApp. The web dashboard works without it.";

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return `You are the WhatsApp assistant for a project management tool. Today is ${weekday}, ${today}.
Convert the user's message into tool calls when they want to act on their board:
- create_task: when they want to add/create a task
- update_task: when they want to change a task - move/complete/start it, retitle it, set priority, due date, or assign it (they usually reference it as #N)
- delete_task: when they explicitly want to remove/delete a task (only when clearly intended)
- get_board_state: when they ask what's on the board, task lists, or progress
- create_workspace: when they want to create/start a new workspace, project, or board (e.g. "create a workspace called Marketing")

Rules:
- Conversation history is context only, never proof of completion. Every actionable request - even one identical to an earlier message - must be executed with fresh tool calls in THIS turn. Never claim something was created, updated, or deleted unless a tool result in this turn confirms it.
- Compound requests need multiple tool calls: execute them one step at a time, using each result before the next call. E.g. "create a workspace and add 3 tasks" = create_workspace first, then create_task three times. Always pass the workspace name on every tool after create_workspace in the same request.
- When the user says "task 1", "task 2", etc. in a batch they just asked you to create, they mean the 1st/2nd/... task you created in THIS request — use the #N shortId from each create_task tool result, NOT the literal number N.
- After all actions are done, reply with ONE short summary of everything that happened (no markdown, plain WhatsApp text). Do not send multiple summaries. If a tool returned an error, say so — never claim success for failed steps.
- Infer scope from context (FRONTEND, BACKEND, DESIGN) only when clear; otherwise omit it.
- Infer priority only when stated or strongly implied (e.g. "urgent" = HIGH); otherwise omit it.
- Resolve relative due dates ("Friday", "tomorrow", "next week") to a concrete YYYY-MM-DD date using today's date above.
- "assign to me" means assignee "me"; a named person means part of their email or name as the assignee parameter.
- Use the conversation history to resolve references: "that task" / "it" usually means the task #N mentioned in your most recent reply.
- If the user names a specific workspace/project, pass it as the "workspace" parameter; otherwise omit it.
- If the message is NOT an actionable board request (greetings, questions, chit-chat), do not call a tool. Reply with one short, friendly sentence telling them what you can do.
- Never invent task IDs or titles.`;
}

// Tool input schemas for Haiku (Anthropic native tool-use).
const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_task",
    description: "Create a new task on the user's project board",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: {
          type: "string",
          description: "Longer task details, only if the user gave any",
        },
        scope: {
          type: "string",
          enum: ["FRONTEND", "BACKEND", "DESIGN", "GENERAL"],
          description: "Area of the task, only if clearly implied",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
          description: "Priority, only if stated or strongly implied",
        },
        dueDate: {
          type: "string",
          description: "Due date as YYYY-MM-DD (resolve relative dates first)",
        },
        assignee: {
          type: "string",
          description:
            "Who to assign: 'me' for the sender, or part of a member's name/email",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description:
      "Change any fields of an existing task referenced by its #N short ID. Only include fields the user wants changed.",
    input_schema: {
      type: "object",
      properties: {
        shortId: { type: "integer", description: "Task short ID (the N in #N)" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
          description: "New status",
        },
        scope: {
          type: "string",
          enum: ["FRONTEND", "BACKEND", "DESIGN", "GENERAL"],
          description: "New scope",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
          description: "New priority",
        },
        dueDate: {
          type: "string",
          description:
            "Due date as YYYY-MM-DD (resolve relative dates first), or empty string to clear",
        },
        assignee: {
          type: "string",
          description:
            "Who to assign: 'me' for the sender, part of a member's name/email, or empty string to unassign",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["shortId"],
    },
  },
  {
    name: "delete_task",
    description:
      "Permanently delete a task referenced by its #N short ID. Only when the user clearly asks for deletion.",
    input_schema: {
      type: "object",
      properties: {
        shortId: { type: "integer", description: "Task short ID (the N in #N)" },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["shortId"],
    },
  },
  {
    name: "get_board_state",
    description: "Get all tasks on the board grouped by status",
    input_schema: {
      type: "object",
      properties: {
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
    },
  },
  {
    name: "create_workspace",
    description:
      "Create a brand-new workspace (project board). Only when the user clearly wants a new workspace, not a task.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the new workspace" },
      },
      required: ["name"],
    },
  },
];

/** Meta webhook verification handshake. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Meta retries non-200 responses aggressively; from here on we always ack
  // and handle errors by messaging the user instead.
  const message = extractInboundMessage(payload);
  if (!message) {
    return NextResponse.json({ status: "ignored" });
  }

  // Meta retries slow webhooks; skip duplicate wamids so we don't create
  // duplicate workspaces or send multiple replies for one user message.
  let claimed = true;
  try {
    claimed = await claimInboundMessage(message.messageId);
  } catch (err) {
    console.error("WhatsApp dedup claim failed:", err);
  }
  if (!claimed) {
    return NextResponse.json({ status: "duplicate" });
  }

  let queueDepth = 1;
  let queueMode: "queued" | "direct" = "queued";
  try {
    const enqueued = await enqueueInboundMessage(message);
    queueDepth = enqueued.depth;
    queueMode = enqueued.mode;
  } catch (err) {
    console.error("WhatsApp enqueue failed:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  if (queueMode === "queued" && queueDepth > 1) {
    await sendWhatsAppText(
      message.from,
      `Queued — ${queueDepth - 1} message${queueDepth - 1 === 1 ? "" : "s"} ahead of yours. I'll work through them in order.`
    ).catch(() => {});
  }

  void markWhatsAppRead(message.messageId).catch(() => {});
  void pruneInboundDedup().catch(() => {});

  try {
    if (queueMode === "direct") {
      await processQueuedMessage(message, false);
    } else {
      if (queueDepth > 1) {
        // Another request may be draining; recover ghost locks from aborted runs.
        await recoverStuckQueue(message.from);
      }
      const result = await ensureQueueProcessed(
        message.from,
        processQueuedMessage
      );
      if (result === "delegated") {
        console.log(
          `[whatsapp] message ${message.messageId} queued (depth ${queueDepth}), active drain`
        );
      }
    }
  } catch (err) {
    console.error("WhatsApp pipeline error:", err);
    await sendWhatsAppText(
      message.from,
      "Something went wrong on our side. Please try again in a moment."
    ).catch(() => {});
  }

  return NextResponse.json({ status: "ok", queueDepth, queueMode });
}

async function processQueuedMessage(message: InboundMessage, queued: boolean) {
  try {
    if (message.kind === "text") {
      const progress = new WhatsAppProgress(message.from, () =>
        touchProcessorLock(message.from)
      );
      await progress.started(queued);
      await handleMessage(message.from, message.text, progress);
    } else {
      if (queued) {
        await sendWhatsAppText(
          message.from,
          "Processing your queued file upload..."
        ).catch(() => {});
      }
      await handleMediaMessage(message);
    }
  } catch (err) {
    console.error("WhatsApp handler error:", err);
    await sendWhatsAppText(
      message.from,
      "Something went wrong on our side. Please try again in a moment."
    ).catch(() => {});
  }
}

/** Images/documents become workspace assets in the user's active workspace. */
async function handleMediaMessage(
  message: Extract<InboundMessage, { kind: "media" }>
) {
  const userId = await getUserIdByPhone(message.from);
  if (!userId) {
    await sendWhatsAppText(message.from, DENIED_MESSAGE);
    return;
  }

  const ctx = await resolveUserWorkspaceContext(userId);
  const file = await downloadWhatsAppMedia(message.mediaId);

  // "#N" anywhere in the caption attaches the file to that task; the rest
  // of the caption becomes comma-separated tags.
  const taskRef = message.caption?.match(/#(\d+)/);
  const taskShortId = taskRef ? Number(taskRef[1]) : undefined;
  const tags = message.caption
    ? message.caption
        .replace(/#\d+/g, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  await uploadAsset({
    workspaceId: ctx.workspaceId,
    uploadedById: userId,
    file,
    fileName: message.fileName,
    fileType: message.mimeType,
    tags,
    taskShortId,
  });

  const reply =
    `Saved "${message.fileName}" to ${ctx.workspaceName}` +
    (taskShortId ? `, attached to task #${taskShortId}` : "'s assets") +
    (tags.length ? ` (tags: ${tags.join(", ")})` : "") +
    ".";
  await sendWhatsAppText(message.from, reply);
  await recordExchange(
    userId,
    `[sent a file: ${message.fileName}]`,
    reply
  ).catch(() => {});
}

/** Compound requests ("create 5 tasks and assign two") need several rounds. */
const MAX_TOOL_TURNS = 16;

type WhatsAppSession = {
  workspaceName: string | null;
  createdTaskShortIds: number[];
};

function buildDeterministicSummary(
  actionResults: string[],
  budgetExhausted: boolean
): string {
  if (actionResults.length === 0) {
    return 'I can create tasks, update their status, or show your board. Try: "add a task to fix the login bug"';
  }

  const lines = actionResults.map((r, i) => `${i + 1}. ${r}`);
  const header = budgetExhausted
    ? "I ran out of action budget before finishing everything. Here's what actually happened:"
    : "Done. Here's what happened:";
  const footer = budgetExhausted
    ? "\n\nSend any remaining steps as a new message and I'll continue."
    : "";

  return `${header}\n\n${lines.join("\n")}${footer}`;
}

async function handleMessage(
  from: string,
  text: string,
  progress?: WhatsAppProgress
) {
  const userId = await getUserIdByPhone(from);
  if (!userId) {
    await sendWhatsAppText(from, DENIED_MESSAGE);
    return;
  }

  // Recent exchanges give Haiku the context to resolve follow-ups like
  // "make that one high priority" (the prior reply names the task #N).
  const history = await getRecentConversation(userId);

  const anthropic = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user" as const, content: text },
  ];

  // Agentic loop: execute every tool call, feed results back, and let the
  // model keep chaining until the whole request is done (or we hit the cap).
  const actionResults: string[] = [];
  let reply: string | null = null;
  let budgetExhausted = true;
  const session: WhatsAppSession = {
    workspaceName: null,
    createdTaskShortIds: [],
  };

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages,
    });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUses.length === 0) {
      budgetExhausted = false;
      if (actionResults.length === 0) {
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === "text"
        );
        reply = textBlock?.text.trim() || null;
      }
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const result = await executeAction(
        userId,
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        session
      );
      actionResults.push(result);
      await progress?.step(result);
      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }
    messages.push({ role: "user", content: results });
  }

  if (actionResults.length > 0) {
    reply = buildDeterministicSummary(actionResults, budgetExhausted);
  } else if (!reply) {
    reply =
      'I can create tasks, update their status, or show your board. Try: "add a task to fix the login bug"';
  }

  await sendWhatsAppText(from, reply);
  await recordExchange(userId, text, reply).catch((err) =>
    console.error("Failed to record conversation:", err)
  );
}

function parseInputDueDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "") return null;
  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

/** "me" (any case) resolves to the sender; otherwise pass through. */
function resolveAssigneeInput(
  value: unknown,
  senderUserId: string
): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  if (str === "") return null;
  if (str.toLowerCase() === "me") return senderUserId;
  return str;
}

function taskSummary(task: {
  shortId: number;
  title: string;
  status: TaskStatus;
  scope: TaskScope;
  priority: TaskPriority;
  dueDate: Date | null;
  assignedTo: { email: string | null } | null;
}): string {
  const parts = [`${task.scope}`, `${task.priority}`];
  if (task.dueDate) parts.push(`due ${task.dueDate.toISOString().slice(0, 10)}`);
  if (task.assignedTo?.email) parts.push(`-> ${task.assignedTo.email}`);
  return `#${task.shortId} "${task.title}" (${parts.join(", ")})`;
}

async function executeAction(
  userId: string,
  action: string,
  input: { workspace?: string; [key: string]: unknown },
  session: WhatsAppSession
): Promise<string> {
  try {
    const workspaceHint =
      (typeof input.workspace === "string" && input.workspace.trim()) ||
      session.workspaceName ||
      undefined;

    // Workspace creation can't resolve a workspace context first: it's the
    // one action a user with zero workspaces must be able to run.
    if (action === "create_workspace") {
      const name = String(input.name ?? "").trim();
      if (!name) return "What should the new workspace be called?";
      const { workspace, created } = await findOrCreateWorkspaceByName(
        userId,
        name
      );
      session.workspaceName = workspace.name;
      revalidateUserWorkspaces(userId, workspace.id);
      return created
        ? `Created workspace "${workspace.name}" — you're its leader and it's now your active workspace. New tasks will land here unless you name another workspace.`
        : `Workspace "${workspace.name}" already exists — using it as your active workspace for the rest of this request.`;
    }

    const ctx = await resolveUserWorkspaceContext(userId, workspaceHint);
    session.workspaceName = ctx.workspaceName;

    switch (action) {
      case "create_task": {
        const task = await createTask({
          workspaceId: ctx.workspaceId,
          title: String(input.title),
          description: input.description
            ? String(input.description)
            : undefined,
          scope: input.scope as TaskScope | undefined,
          priority: input.priority as TaskPriority | undefined,
          dueDate: parseInputDueDate(input.dueDate),
          userId,
        });
        const assignee = resolveAssigneeInput(input.assignee, userId);
        const final = assignee
          ? await updateTask({
              workspaceId: ctx.workspaceId,
              taskId: task.id,
              userId,
              assignee,
            })
          : task;
        session.createdTaskShortIds.push(final.shortId);
        const batchIndex = session.createdTaskShortIds.length;
        return `Done. Created task ${taskSummary(final)} in ${ctx.workspaceName} (batch task ${batchIndex}, shortId #${final.shortId}).`;
      }

      case "update_task": {
        let shortId = Number(input.shortId);
        const ordinal = Number(input.shortId);
        if (
          Number.isInteger(ordinal) &&
          ordinal >= 1 &&
          ordinal <= session.createdTaskShortIds.length &&
          !session.createdTaskShortIds.includes(ordinal)
        ) {
          shortId = session.createdTaskShortIds[ordinal - 1];
        }

        const task = await updateTask({
          workspaceId: ctx.workspaceId,
          shortId,
          userId,
          title: input.title ? String(input.title) : undefined,
          description: input.description
            ? String(input.description)
            : undefined,
          status: input.status as TaskStatus | undefined,
          scope: input.scope as TaskScope | undefined,
          priority: input.priority as TaskPriority | undefined,
          dueDate: parseInputDueDate(input.dueDate),
          assignee: resolveAssigneeInput(input.assignee, userId),
        });
        return `Done. Task ${taskSummary(task)} is now ${task.status.replace("_", " ")} in ${ctx.workspaceName}.`;
      }

      case "delete_task": {
        const task = await deleteTask({
          workspaceId: ctx.workspaceId,
          shortId: Number(input.shortId),
          userId,
        });
        return `Deleted task #${task.shortId} "${task.title}" from ${ctx.workspaceName}.`;
      }

      case "get_board_state": {
        const { board, totalTasks } = await getBoardState(ctx.workspaceId, userId);
        if (totalTasks === 0) {
          return `The board in ${ctx.workspaceName} is empty. Send me a task to get started.`;
        }
        const section = (label: string, tasks: (typeof board)["TODO"]) =>
          tasks.length
            ? `*${label}*\n${tasks
                .map((t) => {
                  let line = `#${t.shortId} ${t.title}`;
                  if (t.priority === "HIGH") line += " ⚠";
                  if (t.dueDate)
                    line += ` (due ${t.dueDate.toISOString().slice(0, 10)})`;
                  if (t.assignedTo?.email)
                    line += ` @${t.assignedTo.email.split("@")[0]}`;
                  return line;
                })
                .join("\n")}`
            : null;
        return [
          `Board for *${ctx.workspaceName}* (${totalTasks} tasks)`,
          section("To Do", board.TODO),
          section("In Progress", board.IN_PROGRESS),
          section("Done", board.DONE),
        ]
          .filter(Boolean)
          .join("\n\n");
      }

      default:
        return "I didn't understand that action. Try creating a task, updating one, or asking for the board.";
    }
  } catch (err) {
    if (err instanceof ServiceError) return err.message;
    throw err;
  }
}
