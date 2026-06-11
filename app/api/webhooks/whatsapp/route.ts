import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  TaskPriority,
  TaskScope,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createTask,
  deleteTask,
  getBoardState,
  resolveUserWorkspaceContext,
  ServiceError,
  updateTask,
} from "@/lib/services/project";
import {
  extractInboundMessage,
  sendWhatsAppText,
  verifyMetaSignature,
} from "@/lib/whatsapp";

/**
 * WhatsApp bot interface (Meta Cloud API webhook).
 *
 * Flow: signature check -> phone lookup -> Claude Haiku with native tool-use
 * extracts the intended action -> service layer executes -> confirmation
 * text sent back via Graph API.
 */

const HAIKU_MODEL = "claude-3-5-haiku-20241022";

const DENIED_MESSAGE =
  "Sorry, this number isn't linked to any account. Ask your team leader for an invite, then add your phone number in the dashboard settings.";

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  return `You are the WhatsApp assistant for a project management tool. Today is ${weekday}, ${today}.
Convert the user's message into exactly one tool call when they want to act on their board:
- create_task: when they want to add/create a task
- update_task: when they want to change a task - move/complete/start it, retitle it, set priority, due date, or assign it (they usually reference it as #N)
- delete_task: when they explicitly want to remove/delete a task (only when clearly intended)
- get_board_state: when they ask what's on the board, task lists, or progress

Rules:
- Infer scope from context (FRONTEND, BACKEND, DESIGN) only when clear; otherwise omit it.
- Infer priority only when stated or strongly implied (e.g. "urgent" = HIGH); otherwise omit it.
- Resolve relative due dates ("Friday", "tomorrow", "next week") to a concrete YYYY-MM-DD date using today's date above.
- "assign to me" means assignee "me"; a named person means part of their email or name as the assignee parameter.
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

  try {
    await handleMessage(message.from, message.text);
  } catch (err) {
    console.error("WhatsApp handler error:", err);
    await sendWhatsAppText(
      message.from,
      "Something went wrong on our side. Please try again in a moment."
    ).catch(() => {});
  }

  return NextResponse.json({ status: "ok" });
}

async function handleMessage(from: string, text: string) {
  const user = await prisma.user.findUnique({
    where: { phone: from },
    select: { id: true },
  });
  if (!user) {
    await sendWhatsAppText(from, DENIED_MESSAGE);
    return;
  }

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(),
    tools: TOOLS,
    messages: [{ role: "user", content: text }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  let reply: string;
  if (toolUse) {
    reply = await executeAction(user.id, toolUse.name, toolUse.input as any);
  } else {
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    reply =
      textBlock?.text.trim() ||
      "I can create tasks, update their status, or show your board. Try: \"add a task to fix the login bug\"";
  }

  await sendWhatsAppText(from, reply);
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
  input: { workspace?: string; [key: string]: unknown }
): Promise<string> {
  try {
    const ctx = await resolveUserWorkspaceContext(userId, input.workspace);

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
        return `Done. Created task ${taskSummary(final)} in ${ctx.workspaceName}.`;
      }

      case "update_task": {
        const task = await updateTask({
          workspaceId: ctx.workspaceId,
          shortId: Number(input.shortId),
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
