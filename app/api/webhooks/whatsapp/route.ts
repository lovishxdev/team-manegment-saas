import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  TaskPriority,
  TaskScope,
  TaskStatus,
} from "@/lib/generated/prisma/client";
import { getUserIdByPhone } from "@/lib/identity-cache";
import {
  assetFileName,
  createTask,
  deleteTask,
  getBoardState,
  listAssets,
  resolveUserWorkspaceContext,
  ServiceError,
  updateAssetTagsByRef,
  updateTask,
  uploadAsset,
} from "@/lib/services/project";
import {
  createWorkspaceLink,
  listWorkspaceLinks,
} from "@/lib/services/links";
import {
  getRecentConversation,
  markWhatsAppChatInitiated,
  recordExchange,
} from "@/lib/services/conversation";
import { findOrCreateWorkspaceByName, renameWorkspace } from "@/lib/services/workspace";
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
import {
  describeSignatureFailure,
  summarizeMetaPayload,
  waWebhookLog,
} from "@/lib/whatsapp-webhook-log";
import {
  formatActionSummary,
  formatAssetList,
  formatBoardState,
  formatLinkList,
  formatTaskDeepLink,
  formatTaskSummary,
} from "@/lib/channel-formatters";
import { workspaceUrl } from "@/lib/app-url";
import { getAppOrigin } from "@/lib/app-origin";
import { isWhatsAppGreeting } from "@/lib/whatsapp-bot";
import {
  BUTTON,
  GREETING_MENU_ROWS,
  HELP_TEXT,
  linkedGreetingBody,
  parseButtonId,
} from "@/lib/whatsapp-interactive";
import {
  sendWhatsAppButtons,
  sendWhatsAppCtaUrl,
  sendWhatsAppList,
  type WhatsAppListRow,
} from "@/lib/whatsapp-messages";
import {
  clearPending,
  consumeContinueMessage,
  getPendingDelete,
  stageContinueMessage,
  stageDeleteTask,
} from "@/lib/whatsapp-pending";
import {
  activateWorkspace,
  formatNoWorkspaceWhatsAppReply,
  listWorkspacePickerOptions,
  parseWorkspacePickId,
  sendWorkspacePicker,
  shouldPromptWorkspacePick,
  userHasAnyWorkspace,
} from "@/lib/whatsapp-workspace";

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

const UNLINKED_GREETING_REPLY =
  "Hey! I'm the Euclis bot. To get started, sign in to Euclis, add this WhatsApp number under Settings → WhatsApp, then send hi again. I'll help you manage tasks from here.";

const NEW_USER_GREETING =
  "Hey! You're linked to Euclis but don't have a workspace yet.\n\nSay something like:\n*create a workspace called My Team*\n\nThen you can add tasks, upload files, and manage your board from here.";

async function sendNoWorkspaceHint(
  from: string,
  userId: string,
  userText: string
): Promise<void> {
  const origin = await getAppOrigin();
  const reply = formatNoWorkspaceWhatsAppReply(origin);
  await sendWhatsAppText(from, reply);
  await recordExchange(userId, userText, reply).catch((err) =>
    console.error("Failed to record conversation:", err)
  );
}

function buildSystemPrompt(activeWorkspaceName: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const workspaceContext = activeWorkspaceName
    ? `The user's active workspace is "${activeWorkspaceName}". Omit the workspace parameter on all tools unless they explicitly name a different workspace.`
    : `The user has NO workspace yet. If they want to get started, call create_workspace (e.g. "create a workspace called Marketing"). Do not use task, board, asset, or link tools until a workspace exists.`;

  return `You are the WhatsApp assistant for a project management tool. Today is ${weekday}, ${today}.

${workspaceContext}

Convert the user's message into tool calls when they want to act on their board:
- create_task: when they want to add/create a task
- update_task: when they want to change a task - move/complete/start it, retitle it, set priority, due date, tags, or assign it (they usually reference it as #N)
- delete_task: when they explicitly want to remove/delete a task (only when clearly intended)
- get_board_state: when they ask what's on the board, task lists, or progress
- create_workspace: when they want to create/start a new workspace, project, or board (e.g. "create a workspace called Marketing")
- rename_workspace: when they want to rename an existing workspace (leader only)
- list_assets: when they ask about uploaded files, photos, or documents in the workspace
- add_link: when they want to save, bookmark, or store a URL for the team (docs, Figma, staging sites, etc.). ALWAYS call this tool to save a link — never claim a link was saved without a tool result in this turn.
- list_links: when they ask what links, bookmarks, or URLs are saved. Call only list_links — do not call add_link in the same turn unless they also asked to save a new link.
- show_workspace_picker: when they want to choose or switch workspace, ask which workspace they're on, or pick a different board — but NOT when they already named a specific workspace to act on (use the workspace parameter on other tools instead). Sends an interactive picker to the chat.
- update_asset_tags: when they want to tag an already-uploaded file/photo (e.g. "tag the last photo booth, marketing" or "remove tag draft from banner.png"). ALWAYS call this tool for tagging requests — never say you cannot tag files.

Rules:
- Images/documents sent directly in WhatsApp (not via this text tool) are saved as assets automatically. Caption text becomes comma-separated tags; #N in the caption attaches the file to task #N. Tell users they can tag on upload by adding a caption like "booth, banner" or "#42 booth".
- You CAN tag and label uploaded files via update_asset_tags. Never claim you lack that capability.
- Conversation history is context only, never proof of completion. Every actionable request - even one identical to an earlier message - must be executed with fresh tool calls in THIS turn. Never claim something was created, updated, or deleted unless a tool result in this turn confirms it.
- Compound requests need multiple tool calls: execute them one step at a time, using each result before the next call. E.g. "create a workspace and add 3 tasks" = create_workspace first, then create_task three times. Always pass the workspace name on every tool after create_workspace in the same request.
- When the user says "task 1", "task 2", etc. in a batch they just asked you to create, they mean the 1st/2nd/... task you created in THIS request — use the #N shortId from each create_task tool result, NOT the literal number N.
- After all actions are done, reply with ONE short summary of everything that happened (no markdown, plain WhatsApp text). Do not send multiple summaries. If a tool returned an error, say so — never claim success for failed steps.
- Infer scope from context (FRONTEND, BACKEND, DESIGN) only when clear; otherwise omit it.
- Infer priority only when stated or strongly implied (e.g. "urgent" = HIGH); otherwise omit it.
- Resolve relative due dates ("Friday", "tomorrow", "next week") to a concrete YYYY-MM-DD date using today's date above.
- "assign to me" means assignee "me"; a named person means part of their email or name as the assignee parameter.
- Use the conversation history to resolve references: "that task" / "it" usually means the task #N mentioned in your most recent reply.
- If the user names a specific workspace/project that is NOT "${activeWorkspaceName}", pass it as the workspace parameter; otherwise always omit workspace.
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
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Free-form labels, e.g. marketing, v2",
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
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Full replacement list of free-form labels",
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
  {
    name: "rename_workspace",
    description:
      "Rename an existing workspace. Only the workspace leader can rename it.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "New workspace name" },
        workspace: {
          type: "string",
          description:
            "Workspace to rename, only if the user explicitly mentioned one",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_assets",
    description:
      "List files/assets uploaded to the workspace (images, documents)",
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
    name: "add_link",
    description:
      "Save an important URL to the workspace Links tab (docs, Figma, staging sites, etc.)",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short label for the link" },
        url: { type: "string", description: "URL (http/https)" },
        description: {
          type: "string",
          description: "Optional note about what the link is for",
        },
        pinned: {
          type: "boolean",
          description: "Pin to the top of the links list",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["title", "url"],
    },
  },
  {
    name: "list_links",
    description:
      "List important URLs saved in the workspace Links tab (pinned links first)",
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
    name: "show_workspace_picker",
    description:
      "Send an interactive workspace picker in WhatsApp when the user wants to choose or switch which workspace/board to use. Use for 'choose workspace', 'which workspace am I on', 'switch workspace' — not when they named a target workspace for a specific action.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_asset_tags",
    description:
      "Add, remove, or replace tags on an uploaded file, photo, or document in the workspace. REQUIRED for any request to tag, label, or categorize an existing upload. Use latest=true for 'last photo' / 'that file'. New uploads with captions are tagged automatically on upload — use this for follow-up tagging via text.",
    input_schema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tag labels to add, remove, or set",
        },
        mode: {
          type: "string",
          enum: ["add", "remove", "set"],
          description:
            "Whether to add to existing tags, remove matching tags, or replace all tags. Default add.",
        },
        latest: {
          type: "boolean",
          description:
            "Target the most recently uploaded asset (use for 'last photo', 'that file', etc.)",
        },
        fileName: {
          type: "string",
          description:
            "Part of the file name to match when not using latest (e.g. 'banner' for banner.png)",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["tags"],
    },
  },
];

/** Meta webhook verification handshake. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const tokenMatch =
    params.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && tokenMatch) {
    waWebhookLog("GET verify OK — Meta handshake succeeded");
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }

  waWebhookLog("GET verify FAILED", {
    mode,
    tokenMatch,
    verifyTokenConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
  });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  waWebhookLog("POST received", {
    bodyBytes: req.headers.get("content-length") ?? "unknown",
    phoneNumberIdEnv: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "(not set)",
  });

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-hub-signature-256");
  const signatureOk = verifyMetaSignature(rawBody, signatureHeader);

  if (!signatureOk) {
    waWebhookLog("POST rejected — invalid signature", {
      reason: describeSignatureFailure(signatureHeader),
      hasBody: rawBody.length > 0,
    });
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    waWebhookLog("POST rejected — JSON parse error");
    return new Response("Bad request", { status: 400 });
  }

  const payloadSummary = summarizeMetaPayload(payload);
  waWebhookLog("POST payload", payloadSummary);

  const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (
    payloadSummary.phoneNumberId &&
    envPhoneNumberId &&
    String(payloadSummary.phoneNumberId) !== envPhoneNumberId
  ) {
    waWebhookLog("PHONE NUMBER ID MISMATCH — replies will fail", {
      incomingFromMeta: payloadSummary.phoneNumberId,
      WHATSAPP_PHONE_NUMBER_ID: envPhoneNumberId,
      fix: `Set WHATSAPP_PHONE_NUMBER_ID=${payloadSummary.phoneNumberId} in .env and redeploy`,
    });
  }

  // Meta retries non-200 responses aggressively; from here on we always ack
  // and handle errors by messaging the user instead.
  const message = extractInboundMessage(payload);
  if (!message) {
    waWebhookLog("POST ignored — no inbound user message (status update or unsupported type)");
    return NextResponse.json({ status: "ignored" });
  }

  waWebhookLog("inbound message", {
    kind: message.kind,
    from: message.from,
    messageId: message.messageId,
    preview:
      message.kind === "text"
        ? message.text.slice(0, 80)
        : message.kind === "interactive"
          ? message.buttonId
          : message.fileName,
  });

  // Meta retries slow webhooks; skip duplicate wamids so we don't create
  // duplicate workspaces or send multiple replies for one user message.
  let claimed = true;
  try {
    claimed = await claimInboundMessage(message.messageId);
  } catch (err) {
    console.error("WhatsApp dedup claim failed:", err);
  }
  if (!claimed) {
    waWebhookLog("duplicate message skipped", { messageId: message.messageId });
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
    waWebhookLog("enqueue failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  waWebhookLog("queued", { queueDepth, queueMode });

  if (queueMode === "queued" && queueDepth > 1) {
    await sendWhatsAppText(
      message.from,
      `Queued. ${queueDepth - 1} message${queueDepth - 1 === 1 ? "" : "s"} ahead of yours. I'll work through them in order.`
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

  waWebhookLog("POST ack", { queueDepth, queueMode });
  return NextResponse.json({ status: "ok", queueDepth, queueMode });
}

async function processQueuedMessage(message: InboundMessage, queued: boolean) {
  try {
    if (message.kind === "text") {
      const progress = new WhatsAppProgress(message.from, () =>
        touchProcessorLock(message.from)
      );
      await handleMessage(message.from, message.text, progress, queued);
    } else if (message.kind === "interactive") {
      await handleInteractiveMessage(message);
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

  await markWhatsAppChatInitiated(userId);

  if (!(await userHasAnyWorkspace(userId))) {
    await sendNoWorkspaceHint(message.from, userId, `[sent a file: ${message.fileName}]`);
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

  revalidateUserWorkspaces(userId, ctx.workspaceId);

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
  phone: string;
  workspaceId: string | null;
  workspaceName: string | null;
  createdTaskShortIds: number[];
  pendingDeleteShortId: number | null;
  lastCreatedTask: { shortId: number; workspaceId: string } | null;
  workspacePickerSent: boolean;
};

async function fetchBoardReply(
  userId: string,
  workspaceHint?: string
): Promise<string> {
  const ctx = await resolveUserWorkspaceContext(userId, workspaceHint);
  const state = await getBoardState(ctx.workspaceId, userId);
  const body = formatBoardState(
    {
      workspaceId: ctx.workspaceId,
      workspaceName: ctx.workspaceName,
      board: state.board,
      totalTasks: state.totalTasks,
    },
    "whatsapp"
  );
  return `${body}\n\nOpen: ${workspaceUrl(ctx.workspaceId)}`;
}

async function sendGreetingWithButtons(
  from: string,
  userId: string,
  workspaceName: string,
  userText: string,
  multiWorkspace: boolean
) {
  const body = linkedGreetingBody(workspaceName);
  const rows: WhatsAppListRow[] = GREETING_MENU_ROWS.map((r) => ({ ...r }));
  if (multiWorkspace) {
    rows.push({
      id: BUTTON.menuSwitch,
      title: "📂 Choose workspace",
      description: "Switch active board",
    });
  }
  const sent = await sendWhatsAppList(
    from,
    body,
    "Choose action",
    [{ title: "Quick actions", rows }],
    { header: "Euclis", footer: workspaceName }
  );
  if (!sent) {
    await sendWhatsAppText(
      from,
      `${body}\n\n• *board* — view tasks\n• describe a task to add one\n• *menu* — this list again`
    );
  }
  await recordExchange(userId, userText, body).catch((err) =>
    console.error("Failed to record conversation:", err)
  );
}

async function handleInteractiveMessage(
  message: Extract<InboundMessage, { kind: "interactive" }>
) {
  const { from, buttonId, title } = message;
  const userId = await getUserIdByPhone(from);
  if (!userId) {
    await sendWhatsAppText(from, DENIED_MESSAGE);
    return;
  }

  await markWhatsAppChatInitiated(userId);

  const userText = `[tapped: ${title || buttonId}]`;
  const hasWorkspace = await userHasAnyWorkspace(userId);

  const action = parseButtonId(buttonId);

  const workspacePickId = parseWorkspacePickId(buttonId);
  if (workspacePickId) {
    try {
      const activated = await activateWorkspace(userId, workspacePickId);
      const pending = await consumeContinueMessage(from, userId);
      if (pending) {
        await recordExchange(
          userId,
          userText,
          `Switched to ${activated.workspaceName}, continuing your request.`
        ).catch(() => {});
        await handleMessage(from, pending);
        return;
      }
      const reply = `Switched to *${activated.workspaceName}*. What would you like to do?`;
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
    } catch (err) {
      const reply =
        err instanceof ServiceError
          ? err.message
          : "Could not switch workspace. Try again.";
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
    }
    return;
  }

  if (!action) {
    const reply = "I didn't recognize that option. Send *menu* for quick actions.";
    await sendWhatsAppText(from, reply);
    await recordExchange(userId, userText, reply).catch(() => {});
    return;
  }

  try {
    if (action.type === "menu_help") {
      await sendWhatsAppText(from, HELP_TEXT);
      await recordExchange(userId, userText, HELP_TEXT).catch(() => {});
      return;
    }

    if (action.type === "menu_add") {
      const reply = hasWorkspace
        ? 'To add a task, message me something like:\n"add a task to fix the login bug"'
        : 'First create a workspace. Say:\n"create a workspace called My Team"';
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "menu_board") {
      if (!hasWorkspace) {
        await sendNoWorkspaceHint(from, userId, userText);
        return;
      }
      const reply = await fetchBoardReply(userId);
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "menu_switch") {
      const options = await listWorkspacePickerOptions(userId);
      if (options.length === 0) {
        await sendNoWorkspaceHint(from, userId, userText);
        return;
      }
      if (options.length <= 1) {
        const reply = "You only belong to one workspace right now.";
        await sendWhatsAppText(from, reply);
        await recordExchange(userId, userText, reply).catch(() => {});
        return;
      }
      await sendWorkspacePicker(
        from,
        options.map((m) => m.workspace),
        "Pick a workspace to use:"
      );
      await recordExchange(userId, userText, "[workspace picker shown]").catch(
        () => {}
      );
      return;
    }

    if (action.type === "delete_cancel") {
      await clearPending(from);
      const reply = "Delete cancelled.";
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (!hasWorkspace) {
      await sendNoWorkspaceHint(from, userId, userText);
      return;
    }

    const ctx = await resolveUserWorkspaceContext(userId);

    if (action.type === "delete_confirm") {
      const pending = await getPendingDelete(from, userId);
      if (!pending || pending.shortId !== action.shortId) {
        const reply =
          "That delete confirmation expired. Ask me to delete the task again.";
        await sendWhatsAppText(from, reply);
        await recordExchange(userId, userText, reply).catch(() => {});
        return;
      }

      const task = await deleteTask({
        workspaceId: pending.workspaceId,
        shortId: pending.shortId,
        userId,
      });
      await clearPending(from);
      revalidateUserWorkspaces(userId, pending.workspaceId);
      const reply = `Deleted #${task.shortId} "${task.title}" from ${pending.workspaceName}.`;
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "task_start" || action.type === "task_done") {
      const task = await updateTask({
        workspaceId: ctx.workspaceId,
        shortId: action.shortId,
        userId,
        status: action.type === "task_start" ? "IN_PROGRESS" : "DONE",
      });
      revalidateUserWorkspaces(userId, ctx.workspaceId);
      const reply =
        `Updated #${task.shortId} *${task.title}* → ${task.status.replace("_", " ")}.` +
        formatTaskDeepLink(ctx.workspaceId, task.shortId, "whatsapp");
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }
  } catch (err) {
    const reply =
      err instanceof ServiceError
        ? err.message
        : "Something went wrong. Try again in a moment.";
    await sendWhatsAppText(from, reply);
    await recordExchange(userId, userText, reply).catch(() => {});
  }
}

async function handleMessage(
  from: string,
  text: string,
  progress?: WhatsAppProgress,
  queued = false
) {
  const userId = await getUserIdByPhone(from);
  if (!userId) {
    waWebhookLog("user not linked", {
      from,
      hint: "Save this exact number in Settings → WhatsApp (E.164, no +)",
    });
    const reply = isWhatsAppGreeting(text) ? UNLINKED_GREETING_REPLY : DENIED_MESSAGE;
    const sent = await sendWhatsAppText(from, reply);
    waWebhookLog("denied reply sent", { ok: sent, greeting: isWhatsAppGreeting(text) });
    return;
  }

  waWebhookLog("user matched", { from, userId });

  await markWhatsAppChatInitiated(userId);

  const hasWorkspace = await userHasAnyWorkspace(userId);

  if (isWhatsAppGreeting(text)) {
    if (!hasWorkspace) {
      await sendWhatsAppText(from, NEW_USER_GREETING);
      await recordExchange(userId, text, NEW_USER_GREETING).catch(() => {});
      return;
    }
    try {
      const ctx = await resolveUserWorkspaceContext(userId);
      const memberships = await listWorkspacePickerOptions(userId);
      await sendGreetingWithButtons(
        from,
        userId,
        ctx.workspaceName,
        text,
        memberships.length > 1
      );
      return;
    } catch (err) {
      const msg =
        err instanceof ServiceError
          ? err.message
          : "Something went wrong. Try again in a moment.";
      await sendWhatsAppText(from, msg);
      await recordExchange(userId, text, msg).catch(() => {});
      return;
    }
  }

  if (hasWorkspace && (await shouldPromptWorkspacePick(userId))) {
    const options = await listWorkspacePickerOptions(userId);
    await stageContinueMessage(from, userId, text);
    await sendWorkspacePicker(
      from,
      options.map((m) => m.workspace),
      "Before I continue, which workspace should this apply to?"
    );
    await recordExchange(userId, text, "[workspace picker shown]").catch(() => {});
    return;
  }

  // Recent exchanges give Haiku the context to resolve follow-ups like
  // "make that one high priority" (the prior reply names the task #N).
  const history = await getRecentConversation(userId);
  const activeCtx = hasWorkspace
    ? await resolveUserWorkspaceContext(userId)
    : { workspaceId: null, workspaceName: null };

  progress?.beginSlowPing(queued);

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
    phone: from,
    workspaceId: activeCtx.workspaceId,
    workspaceName: activeCtx.workspaceName,
    createdTaskShortIds: [],
    pendingDeleteShortId: null,
    lastCreatedTask: null,
    workspacePickerSent: false,
  };

  try {
  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(activeCtx.workspaceName),
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
  } finally {
    progress?.finish();
  }

  const textResults = actionResults.filter((r) => r.trim().length > 0);

  if (textResults.length > 0) {
    reply = formatActionSummary(textResults, budgetExhausted, "whatsapp");
  } else if (!reply && !session.workspacePickerSent) {
    reply =
      'I can create tasks, update their status, tag uploaded files, or show your board. Try: "add a task to fix the login bug" or send *menu*.';
  }

  if (reply) {
    await sendWhatsAppText(from, reply);
    await recordExchange(userId, text, reply).catch((err) =>
      console.error("Failed to record conversation:", err)
    );
  } else if (session.workspacePickerSent) {
    await recordExchange(userId, text, "[workspace picker shown]").catch((err) =>
      console.error("Failed to record conversation:", err)
    );
  }

  if (session.pendingDeleteShortId) {
    const pending = await getPendingDelete(from, userId);
    if (pending) {
      await sendWhatsAppButtons(
        from,
        `Delete *#${pending.shortId}* "${pending.taskTitle}"?`,
        [
          { id: BUTTON.deleteConfirm(pending.shortId), title: "🗑 Delete" },
          { id: BUTTON.deleteCancel, title: "✖ Cancel" },
        ],
        { header: "Confirm delete", footer: "This cannot be undone" }
      ).catch(() => {});
    }
  } else if (session.lastCreatedTask) {
    const { shortId, workspaceId } = session.lastCreatedTask;
    await sendWhatsAppButtons(
      from,
      `Update *#${shortId}* or open it on the web.`,
      [
        { id: BUTTON.taskStart(shortId), title: "▶ In progress" },
        { id: BUTTON.taskDone(shortId), title: "✅ Done" },
      ],
      { header: `Task #${shortId}`, footer: "Tap to update status" }
    ).catch(() => {});
    await sendWhatsAppCtaUrl(
      from,
      "Open your workspace in the browser.",
      "Open board",
      workspaceUrl(workspaceId),
      { footer: "Euclis dashboard" }
    ).catch(() => {});
  }
}

function parseInputDueDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "") return null;
  const parsed = new Date(String(value));
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseTagsInput(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.map((t) => String(t).trim()).filter(Boolean);
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

async function executeAction(
  userId: string,
  action: string,
  input: { workspace?: string; [key: string]: unknown },
  session: WhatsAppSession
): Promise<string> {
  try {
    const explicitWorkspace =
      typeof input.workspace === "string" && input.workspace.trim()
        ? input.workspace.trim()
        : undefined;

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
      session.workspaceId = workspace.id;
      revalidateUserWorkspaces(userId, workspace.id);
      return created
        ? `Created workspace "${workspace.name}". You're its leader and it's now your active workspace. New tasks will land here unless you name another workspace.`
        : `Workspace "${workspace.name}" already exists. Using it as your active workspace for the rest of this request.`;
    }

    const ctx = explicitWorkspace
      ? await resolveUserWorkspaceContext(userId, explicitWorkspace)
      : session.workspaceId && session.workspaceName
        ? {
            workspaceId: session.workspaceId,
            workspaceName: session.workspaceName,
          }
        : await resolveUserWorkspaceContext(userId);

    session.workspaceName = ctx.workspaceName;
    session.workspaceId = ctx.workspaceId;

    waWebhookLog("workspace context", {
      action,
      workspaceId: ctx.workspaceId,
      workspaceName: ctx.workspaceName,
      explicitWorkspace: explicitWorkspace ?? null,
    });

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
          tags: parseTagsInput(input.tags),
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
        session.lastCreatedTask = {
          shortId: final.shortId,
          workspaceId: ctx.workspaceId,
        };
        const batchIndex = session.createdTaskShortIds.length;
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        waWebhookLog("task created", {
          workspaceId: ctx.workspaceId,
          workspaceName: ctx.workspaceName,
          shortId: final.shortId,
        });
        return (
          `Done. Created ${formatTaskSummary(final, ctx.workspaceName, "whatsapp")}` +
          formatTaskDeepLink(ctx.workspaceId, final.shortId, "whatsapp") +
          ` (batch task ${batchIndex}).`
        );
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
          tags: parseTagsInput(input.tags),
          assignee: resolveAssigneeInput(input.assignee, userId),
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return (
          `Done. ${formatTaskSummary(task, ctx.workspaceName, "whatsapp")} is now ${task.status.replace("_", " ")}.` +
          formatTaskDeepLink(ctx.workspaceId, task.shortId, "whatsapp")
        );
      }

      case "delete_task": {
        const shortId = Number(input.shortId);
        const { board } = await getBoardState(ctx.workspaceId, userId);
        const all = [...board.TODO, ...board.IN_PROGRESS, ...board.DONE];
        const existing = all.find((t) => t.shortId === shortId);
        if (!existing) {
          return `No task #${shortId} in ${ctx.workspaceName}.`;
        }

        await stageDeleteTask(session.phone, userId, {
          workspaceId: ctx.workspaceId,
          workspaceName: ctx.workspaceName,
          shortId,
          taskTitle: existing.title,
        });
        session.pendingDeleteShortId = shortId;
        return `Ready to delete #${shortId} "${existing.title}". I'll send Confirm / Cancel buttons next.`;
      }

      case "get_board_state": {
        const state = await getBoardState(ctx.workspaceId, userId);
        const body = formatBoardState(
          {
            workspaceId: ctx.workspaceId,
            workspaceName: ctx.workspaceName,
            board: state.board,
            totalTasks: state.totalTasks,
          },
          "whatsapp"
        );
        return `${body}\n\nOpen: ${workspaceUrl(ctx.workspaceId)}`;
      }

      case "rename_workspace": {
        const name = String(input.name ?? "").trim();
        if (!name) return "What should the workspace be renamed to?";
        const updated = await renameWorkspace(ctx.workspaceId, userId, name);
        session.workspaceName = updated.name;
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return `Renamed workspace to *${updated.name}*.`;
      }

      case "list_assets": {
        const assets = await listAssets(ctx.workspaceId, userId);
        return formatAssetList(ctx.workspaceName, assets, "whatsapp");
      }

      case "add_link": {
        const title = String(input.title ?? "").trim();
        const url = String(input.url ?? "").trim();
        if (!title || !url) return "I need a title and URL to save a link.";
        const link = await createWorkspaceLink({
          workspaceId: ctx.workspaceId,
          userId,
          title,
          url,
          description:
            typeof input.description === "string"
              ? input.description
              : undefined,
          pinned: input.pinned === true,
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return (
          `Saved link *${link.title}* in *${ctx.workspaceName}*${link.pinned ? " (pinned)" : ""}:\n${link.url}` +
          (link.description ? `\n_${link.description}_` : "")
        );
      }

      case "list_links": {
        const links = await listWorkspaceLinks(ctx.workspaceId, userId);
        return formatLinkList(ctx.workspaceName, links, "whatsapp");
      }

      case "show_workspace_picker": {
        if (session.workspacePickerSent) return "";
        const options = await listWorkspacePickerOptions(userId);
        if (options.length === 0) {
          return 'You have no workspaces yet. Say: "create a workspace called My Team"';
        }
        if (options.length <= 1) {
          return `You only have one workspace (*${ctx.workspaceName}*).`;
        }
        const sent = await sendWorkspacePicker(
          session.phone,
          options.map((m) => m.workspace),
          `You're on *${ctx.workspaceName}*. Pick a workspace:`
        );
        if (sent) {
          session.workspacePickerSent = true;
          return "";
        }
        return "Could not send the workspace picker. Try again in a moment.";
      }

      case "update_asset_tags": {
        const rawTags = input.tags;
        const tags = Array.isArray(rawTags)
          ? rawTags.map((t) => String(t))
          : String(rawTags ?? "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
        if (tags.length === 0) {
          return "Which tags should I apply?";
        }

        const mode =
          input.mode === "set" || input.mode === "remove" ? input.mode : "add";
        const latest = input.latest === true;
        const fileName =
          typeof input.fileName === "string" ? input.fileName : undefined;

        const asset = await updateAssetTagsByRef({
          workspaceId: ctx.workspaceId,
          userId,
          tags,
          mode,
          latest: latest || (!fileName && mode !== "set"),
          fileName,
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);

        const name = assetFileName(asset.url);
        const tagLine =
          asset.tags.length > 0 ? asset.tags.join(", ") : "(none)";
        return `Updated tags on "${name}" in ${ctx.workspaceName}: ${tagLine}.`;
      }

      default:
        return "I didn't understand that action. Try creating a task, updating one, or asking for the board.";
    }
  } catch (err) {
    if (err instanceof ServiceError) {
      if (err.code === "NO_WORKSPACE") {
        return 'You need a workspace first. Say: "create a workspace called My Team"';
      }
      return err.message;
    }
    throw err;
  }
}
