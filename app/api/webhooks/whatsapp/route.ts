import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/generated/prisma/client";
import { getUserIdByPhone } from "@/lib/identity-cache";
import {
  deleteTask,
  getBoardState,
  getTask,
  resolveUserWorkspaceContext,
  ServiceError,
  updateTask,
  uploadAsset,
} from "@/lib/services/project";
import { lastTaskShortIdFromTurns } from "@/lib/whatsapp-task-context";
import { formatTaskRef } from "@/lib/whatsapp-task-ref";
import {
  getLastDiscussedTask,
  getRecentConversation,
  markWhatsAppChatInitiated,
  recordExchange,
  setLastDiscussedTask,
  type ConversationTurn,
} from "@/lib/services/conversation";
import {
  acceptInvite,
  demoteMemberById,
  formatMemberRole,
} from "@/lib/services/workspace";
import { displayUser } from "@/lib/username";
import { MAX_BATCH_INVITES } from "@/lib/services/invites";
import {
  runDeleteAssetConfirmed,
  runRemoveMemberConfirmed,
  MAX_BULK_TASK_UPDATES,
} from "@/lib/bot/extended-tools";
import { sendWhatsAppImageBuffer } from "@/lib/whatsapp-media";
import { revalidateUserWorkspaces } from "@/lib/revalidate-nav";
import {
  claimInboundMessage,
  pruneInboundDedup,
} from "@/lib/whatsapp-inbound";
import { WhatsAppProgress } from "@/lib/whatsapp-progress";
import {
  runWhatsAppAgentLoop,
  type AgentLoopResult,
} from "@/lib/whatsapp-agent-loop";
import { buildWhatsAppHaikuTools } from "@/lib/whatsapp-tool-search";
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
  formatBoardState,
  mapBoardSnapshot,
} from "@/lib/channel-formatters";
import { formatWhatsAppUserReply } from "@/lib/whatsapp-voice";
import {
  guardWhatsAppReply,
  INQUIRY_TOOLS,
  pickReplyOutcomes,
} from "@/lib/whatsapp-reply-guard";
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
  getPendingDemote,
  getPendingRemoveMember,
  getPendingDeleteAsset,
  peekContinueMessage,
  stageContinueMessage,
} from "@/lib/whatsapp-pending";
import {
  activateWorkspace,
  formatNoWorkspaceWhatsAppReply,
  listWorkspacePickerOptions,
  parseWorkspacePickId,
  sendWorkspacePicker,
  shouldPromptWorkspacePick,
  tryActivateWorkspaceFromText,
  userHasAnyWorkspace,
} from "@/lib/whatsapp-workspace";
import {
  dispatchWhatsAppTool,
  whatsappAnthropicTools,
} from "@/lib/tools/registry";
import {
  confirmSuggestedResolution,
  dismissSuggestedResolution,
} from "@/lib/memory/suggest";
import type { WhatsAppSessionState } from "@/lib/tools/types";

/**
 * WhatsApp bot interface (Meta Cloud API webhook).
 *
 * Flow: signature check -> phone lookup -> single agent loop (Claude with
 * native tool-use over the shared registry) -> deterministic reply guard ->
 * Graph API send. Same architecture as the MCP connector, plus a chat loop.
 */

/** One capable model runs the whole conversation — no triage router. */
const WHATSAPP_AGENT_MODEL =
  process.env.WHATSAPP_AGENT_MODEL?.trim() || "claude-sonnet-4-5";

const DENIED_MESSAGE =
  "This number isn't linked yet. Sign in at Euclis → Settings → WhatsApp, add your phone, then message me again.";

const UNLINKED_GREETING_REPLY =
  "Hey! Link this number in Euclis (Settings → WhatsApp), then send *hi* and we'll get going.";

const NEW_USER_GREETING =
  "Hey! You're in Euclis but don't have a workspace yet.\n\nTry: *create a workspace called My Team*";

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

  return `You are Euclis on WhatsApp — a sharp, friendly teammate who helps manage tasks. Today is ${weekday}, ${today}. Sound human: short sentences, contractions, no corporate filler. Never say "Here's what happened", "I have successfully", or "Done." as a opener.

WhatsApp formatting: bold = *single asterisks* only. Never use **markdown** or *Section:* headers — use plain "To do:" for board sections.

Voice examples:
- User: "mark login bug done" → after update_task: leave final text empty (tool output is sent to the user).
- User: "what's on the board" → call get_board_state only; leave final text empty — never summarize with #N.
- User: "I started 2 reddit posts" (after discussing a task) → add_task_update with body = their words; leave final text empty.
- User: "Just uploaded the design files to the task" → this is a PROGRESS REPORT, not a file upload. Call add_task_update with their words. A text message can never upload or attach files — only actual image/document messages do.
- User: "what's going on with the login redesign" → call ask_task, then WRITE the answer yourself: 2–5 short sentences leading with what they asked (status, blocker, latest), specific facts from the thread only.
- Bad: "Marked #1 as done" or "You've got #1 Seo Queries" — never use #N in user-facing text; use *task titles*.
- Good tool outcomes: "Added *Return From Gym*." / "Updated *Seo Queries* → done." / board lists *Title* · status

${workspaceContext}

Convert the user's message into tool calls when they want to act on their board:
- create_task: when they want to add/create a task. Use a SHORT title (a few words, under ~80 chars). Put bullet lists, long paragraphs, SEO keywords, and detailed requirements in description — never dump them all into title.
- update_task: when they want to change a task - move/complete/start it, retitle it, set priority, due date, tags, or assign it (they usually reference it as #N)
- ask_task: BEST for status / "what's going on" / "what's wrong with X" questions. One call: finds the task (semantic) + includes the full update thread. Pass the user's full question as query. Use shortId only if they gave #N.
- find_task: locate a task by description only (no updates). Prefer ask_task for status questions.
- search_tasks: filter tasks by tag, category, status, assignee, or keywords (structured search).
- list_task_updates: when they ask what's happening, what's pending, or recent activity on a task (#N). Prefer this over read_task for status questions.
- read_task: full task metadata (status, assignees, tags, description). Skip if list_task_updates already answers their question.
- add_task_update: post a progress note on a task (#N) — "I started X", "blocked on Y", "shipped Z". Use the user's words as body. ALWAYS call this when they report progress or confirm they want to post an update. Never tell them to use the web app instead.
- delete_task: when they explicitly want to remove/delete a task (only when clearly intended). This stages a Confirm/Cancel button flow — never claim the task is deleted until they confirm.
- get_board_state: when they ask what's on the board, task lists, or progress
- create_workspace: when they want to create/start a new workspace, project, or board (e.g. "create a workspace called Marketing")
- rename_workspace: when they want to rename an existing workspace (leader only)
- list_assets: when they ask about uploaded files, photos, or documents in the workspace
- attach_asset_to_task: when they want to attach a previously uploaded file/photo to a task (e.g. "add the image I uploaded to task #1"). Use latest=true for "the image I uploaded" / "last photo". Call list_assets first if you need to confirm the file exists.
- add_link: when they want to save, bookmark, or store a URL for the team (docs, Figma, staging sites, etc.). ALWAYS call this tool to save a link — never claim a link was saved without a tool result in this turn.
- list_links: when they ask what links, bookmarks, or URLs are saved. Call only list_links — do not call add_link in the same turn unless they also asked to save a new link.
- show_workspace_picker: when they want to choose or switch workspace, ask which workspace they're on, or pick a different board — but NOT when they already named a specific workspace to act on (use the workspace parameter on other tools instead). Sends an interactive picker to the chat.
- update_asset_tags: when they want to tag an already-uploaded file/photo (e.g. "tag the last photo booth, marketing" or "remove tag draft from banner.png"). ALWAYS call this tool for tagging requests — never say you cannot tag files.
- invite_members: when they want to add teammates by username, email, or phone (up to ${MAX_BATCH_INVITES} people in one message). Leaders/sub-leaders only.
- list_workspace_members: when they ask who is on the team or who is in the workspace
- create_invite_link: when they want a generic shareable invite link (not directed at a specific person)
- promote_member: when they want to promote someone to sub-leader or leader (leader only)
- demote_member: when they want to lower someone's role (leader only). Stages Confirm/Cancel buttons — never claim demotion happened until they confirm.
- list_my_tasks: when they ask what's assigned to them or their open tasks
- list_workspaces: when they ask which workspaces they're in
- switch_workspace: when they want to change the active workspace by name
- workspace_summary: when they want a quick overview (open tasks, members, counts)
- read_asset: when they ask about a specific uploaded file (latest upload or by name)
- delete_asset: when they want to remove an uploaded file. Stages Confirm/Cancel buttons.
- delete_link: when they want to remove a saved link (by title or URL)
- update_link: when they want to edit a link's title, URL, description, or pin state
- pin_link: when they want to pin or unpin a saved link
- remove_member: when they want to kick someone from the workspace (leader only). Stages Confirm/Cancel buttons.
- list_categories: when they ask what task categories exist in the workspace
- create_category: when they want to add a new task category (e.g. Legal, Ops)
- leave_workspace: when they want to leave the current team/workspace (blocked if they're the only leader with other members)
- bulk_update_tasks: when they want to update many tasks at once (e.g. mark #1–#4 done, move all Design tasks to in progress). Max ${MAX_BULK_TASK_UPDATES} per call.
- unassign_task: when they want to clear all assignees from a specific task (#N)
- export_whiteboard: when they want screenshots of the team whiteboard (up to 5 images sent in chat)
- recall_memory: when they ask WHY something was decided, what happened with a topic, or project history ("why did we go with X", "what was decided about Y"). Answer from the returned records in your own words.
- list_blockers: when they ask what's blocked, stuck, or waiting — workspace-wide or for one task.
- record_decision: when they explicitly want something remembered ("log this decision", "note that we're blocked on the API keys"). Decisions/blockers in normal updates are captured automatically — use this only for explicit asks.
- resolve_blocker: when they confirm a blocker is cleared. Get the event id from list_blockers/recall_memory first; never resolve without their clear confirmation.
- get_project_context: when someone wants full background/context on a piece of work before starting it.

Rules:
- Images/documents sent directly in WhatsApp (not via this text tool) are saved as assets automatically. Caption text becomes comma-separated tags; #N in the caption attaches the file to task #N. Tell users they can tag on upload by adding a caption like "booth, banner" or "#42 booth".
- You CAN tag and label uploaded files via update_asset_tags. Never claim you lack that capability.
- Conversation history is context only, never proof of completion. Every actionable request - even one identical to an earlier message - must be executed with fresh tool calls in THIS turn. Never claim something was created, updated, or deleted unless a tool result in this turn confirms it.
- Compound requests need multiple tool calls: execute them one step at a time, using each result before the next call. E.g. "create a workspace and add 3 tasks" = create_workspace first, then create_task three times. Always pass the workspace name on every tool after create_workspace in the same request.
- When the user says "task 1", "task 2", etc. referring to tasks they just asked you to create in THIS message, they mean the 1st/2nd/... task created in this request — use the #N shortId from each create_task tool result, NOT the literal number N. But "previous task", "the other task", or a task named by title (e.g. "go to the gym") always means an EXISTING task from before the new creates — look up its #N via get_board_state or use the title match; never mark a newly created task done when they asked about a previous one.
- "Previous task" / "the task before" / a task referenced by title is NEVER the task you just created in the same message unless they explicitly mean the new one.
- After MUTATIONS (create/update/delete/post/invite) and board lists: leave your final text EMPTY — the app sends the formatted tool output directly. Never restate confirmations.
- After INQUIRY tools (ask_task, read_task, list_task_updates, find_task, search_tasks): ALWAYS write the final answer yourself. 2–5 short sentences or up to 4 bullets. Lead with exactly what they asked. Use facts from the tool result only — never invent, never paste the raw thread or labeled dumps (Status:, Updates (N):), never use #N.
- Compound requests (multiple things in one message): call a tool for every actionable part. If you cannot do a part (missing info, no matching task, ambiguous target), do NOT skip silently — either let the tool fail with a clear error, or end your turn with a short note listing what could NOT be done and why (e.g. "Could not attach image: no task specified").
- Infer category from context (e.g. marketing, ops, frontend) only when clear; otherwise omit it.
- Infer priority only when stated or strongly implied (e.g. "urgent" = HIGH); otherwise omit it.
- Resolve relative due dates ("Friday", "tomorrow", "next week") to a concrete YYYY-MM-DD date using today's date above.
- "assign to me" means assignee "me"; multiple people can be assigned via the assignees array (e.g. ["me", "aarav"]).
- Use the conversation history to resolve references: "that task" / "it" / a task name usually means what you just discussed.
- Never ask the user for "#N" or "short ID" — they use task names. If unclear, list task titles.
- If the user names a specific workspace/project that is NOT "${activeWorkspaceName}", pass it as the workspace parameter; otherwise always omit workspace.
- If the message is NOT an actionable board request (greetings, questions, chit-chat), do not call a tool. Reply with one warm, brief sentence — not a feature list.
- Task description = stable requirements/spec. Task updates = chronological team notes.
- Progress reports ("I started…", "blocked on…", "finished…", "just uploaded/fixed/sent…") on the task you just discussed → add_task_update with body = their message (verbatim). When someone says they uploaded/added/sent files IN A TEXT MESSAGE, that is a progress report to post — never claim files were attached, and never mention captions or tags.
- If you offered to post an update and they confirm ("yes", "post that") → add_task_update with body = the exact text you offered, phrased in their first person.
- If you offered to post an update and they say yes / "post that" → add_task_update immediately with the text you offered (or their earlier message).
- You CAN post task updates from WhatsApp via add_task_update. Never say you cannot or send them to the web app for notes.
- Named task without #N: ask_task with their full question (preferred) OR find_task then list_task_updates.
- Status / "what's going on" questions: ask_task ONLY — do not also call find_task, list_task_updates, or read_task.
- After read_task, answer only the part the user asked for unless they wanted full details.
- Never invent task IDs or titles.`;
}

// Anthropic tool schemas are generated from the shared registry
// (lib/tools/registry.ts) — single source of truth with MCP and dispatch.
const TOOLS: Anthropic.Tool[] = whatsappAnthropicTools();

/** Whiteboard export uses headless Chromium; cold starts may download a large pack. */
export const maxDuration = 120;

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

  void markWhatsAppRead(message.messageId, { typing: true }).catch(() => {});
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
      const progress = new WhatsAppProgress(message.messageId, () =>
        touchProcessorLock(message.from)
      );
      await handleMessage(
        message.from,
        message.text,
        progress,
        queued,
        message.messageId
      );
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

  let taskTitle: string | undefined;
  if (taskShortId) {
    try {
      const task = await getTask(ctx.workspaceId, userId, taskShortId);
      taskTitle = task.title;
    } catch {
      taskTitle = undefined;
    }
  }

  const reply =
    `Saved "${message.fileName}" to ${ctx.workspaceName}` +
    (taskTitle
      ? `, attached to ${formatTaskRef(taskTitle)}`
      : taskShortId
        ? ", attached to that task"
        : "'s assets") +
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

/** Session state shape is owned by the tool registry (lib/tools/types.ts). */
type WhatsAppSession = WhatsAppSessionState;

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
      board: mapBoardSnapshot(state.board),
      totalTasks: state.totalTasks,
    },
    "whatsapp"
  );
  return `${body}\n\nOpen: ${workspaceUrl(ctx.workspaceId)}`;
}

/** Buttons, whiteboard images, and post-create flows after a text reply. */
async function sendPostActionFollowUps(
  from: string,
  userId: string,
  _userText: string,
  session: WhatsAppSession
) {
  if (session.whiteboardImages && session.whiteboardImages.length > 0) {
    const total = session.whiteboardImages.length;
    const name = session.workspaceName ?? "workspace";
    for (let i = 0; i < total; i++) {
      await sendWhatsAppImageBuffer(
        from,
        session.whiteboardImages[i],
        `Whiteboard ${i + 1}/${total} · ${name}`
      ).catch(() => {});
    }
    session.whiteboardImages = null;
  } else if (session.pendingRemoveMember) {
    const pending = await getPendingRemoveMember(from, userId);
    if (pending) {
      await sendWhatsAppButtons(
        from,
        `Remove *@${pending.targetLabel}* from ${pending.workspaceName}?`,
        [
          { id: BUTTON.removeConfirm(pending.targetUserId), title: "🚫 Remove" },
          { id: BUTTON.deleteCancel, title: "✖ Cancel" },
        ],
        { header: "Confirm removal", footer: "Leader action" }
      ).catch(() => {});
    }
  } else if (session.pendingDeleteAsset) {
    const pending = await getPendingDeleteAsset(from, userId);
    if (pending) {
      await sendWhatsAppButtons(
        from,
        `Delete file *${pending.fileName}* from ${pending.workspaceName}?`,
        [
          {
            id: BUTTON.deleteAssetConfirm(pending.assetId),
            title: "🗑 Delete",
          },
          { id: BUTTON.deleteCancel, title: "✖ Cancel" },
        ],
        { header: "Confirm delete file", footer: "This cannot be undone" }
      ).catch(() => {});
    }
  } else if (session.pendingDemote) {
    const pending = await getPendingDemote(from, userId);
    if (pending) {
      await sendWhatsAppButtons(
        from,
        `Demote *@${pending.targetLabel}* from ${formatMemberRole(pending.currentRole as Role)} to ${formatMemberRole(pending.newRole as Role)}?`,
        [
          {
            id: BUTTON.demoteConfirm(pending.targetUserId, pending.newRole),
            title: "⬇ Demote",
          },
          { id: BUTTON.deleteCancel, title: "✖ Cancel" },
        ],
        { header: "Confirm demotion", footer: "Leader action" }
      ).catch(() => {});
    }
  } else if (session.pendingDeleteShortId) {
    const pending = await getPendingDelete(from, userId);
    if (pending) {
      await sendWhatsAppButtons(
        from,
        `Delete ${formatTaskRef(pending.taskTitle)}?`,
        [
          { id: BUTTON.deleteConfirm(pending.shortId), title: "🗑 Delete" },
          { id: BUTTON.deleteCancel, title: "✖ Cancel" },
        ],
        { header: "Confirm delete", footer: "This cannot be undone" }
      ).catch(() => {});
    }
  } else if (session.lastCreatedTask) {
    const { shortId, workspaceId, title } = session.lastCreatedTask;
    await sendWhatsAppButtons(
      from,
      `Mark ${formatTaskRef(title)} in progress or done — or open it on the web.`,
      [
        { id: BUTTON.taskStart(shortId), title: "▶ In progress" },
        { id: BUTTON.taskDone(shortId), title: "✅ Done" },
      ],
      { header: title.slice(0, 60), footer: "Tap to update status" }
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

    if (action.type === "invite_decline") {
      const reply =
        "Invite declined. (If you didn't expect this invitation, you're all set.)";
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "invite_accept") {
      try {
        const workspace = await acceptInvite(action.inviteId, userId);
        revalidateUserWorkspaces(userId, workspace.id);
        const reply = `Welcome to *${workspace.name}*! You're now a member. Send *menu* for quick actions.`;
        await sendWhatsAppText(from, reply);
        await recordExchange(userId, userText, reply).catch(() => {});
      } catch (err) {
        const reply =
          err instanceof ServiceError
            ? err.message
            : "Could not accept the invite. It may have expired.";
        await sendWhatsAppText(from, reply);
        await recordExchange(userId, userText, reply).catch(() => {});
      }
      return;
    }

    if (action.type === "delete_cancel") {
      await clearPending(from);
      const reply = "Cancelled.";
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "memory_resolve_confirm") {
      const reply = await confirmSuggestedResolution(action.eventId, userId);
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "memory_resolve_dismiss") {
      const reply = await dismissSuggestedResolution(action.eventId);
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (!hasWorkspace) {
      await sendNoWorkspaceHint(from, userId, userText);
      return;
    }

    const ctx = await resolveUserWorkspaceContext(userId);

    if (action.type === "demote_confirm") {
      const pending = await getPendingDemote(from, userId);
      if (
        !pending ||
        pending.targetUserId !== action.targetUserId ||
        pending.newRole !== action.newRole
      ) {
        const reply =
          "That demotion confirmation expired. Ask me to demote them again.";
        await sendWhatsAppText(from, reply);
        await recordExchange(userId, userText, reply).catch(() => {});
        return;
      }

      const updated = await demoteMemberById(
        pending.workspaceId,
        userId,
        pending.targetUserId,
        action.newRole as Role
      );
      await clearPending(from);
      revalidateUserWorkspaces(userId, pending.workspaceId);
      const reply = `Demoted @${displayUser(updated.user)} to ${formatMemberRole(updated.role)} in ${pending.workspaceName}.`;
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "remove_confirm") {
      const pending = await getPendingRemoveMember(from, userId);
      if (!pending || pending.targetUserId !== action.targetUserId) {
        const reply =
          "That removal confirmation expired. Ask me to remove them again.";
        await sendWhatsAppText(from, reply);
        await recordExchange(userId, userText, reply).catch(() => {});
        return;
      }

      const reply = await runRemoveMemberConfirmed(
        pending,
        userId,
        "whatsapp"
      );
      await clearPending(from);
      revalidateUserWorkspaces(userId, pending.workspaceId);
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

    if (action.type === "delete_asset_confirm") {
      const pending = await getPendingDeleteAsset(from, userId);
      if (!pending || pending.assetId !== action.assetId) {
        const reply =
          "That delete confirmation expired. Ask me to delete the file again.";
        await sendWhatsAppText(from, reply);
        await recordExchange(userId, userText, reply).catch(() => {});
        return;
      }

      const reply = await runDeleteAssetConfirmed(
        pending,
        userId,
        "whatsapp"
      );
      await clearPending(from);
      revalidateUserWorkspaces(userId, pending.workspaceId);
      await sendWhatsAppText(from, reply);
      await recordExchange(userId, userText, reply).catch(() => {});
      return;
    }

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
      const reply = `Deleted ${formatTaskRef(task.title)} from ${pending.workspaceName}.`;
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
      const statusLabel =
        task.status === "DONE"
          ? "done"
          : task.status === "IN_PROGRESS"
            ? "in progress"
            : "to do";
      const reply = `Updated ${formatTaskRef(task.title)} → ${statusLabel}.`;
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
  queued = false,
  _inboundMessageId?: string
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
    const activated = await tryActivateWorkspaceFromText(userId, text);
    if (activated) {
      const pending = await consumeContinueMessage(from, userId);
      const toRun = pending ?? text;
      await recordExchange(
        userId,
        text,
        `Using *${activated.workspaceName}* — on it.`
      ).catch(() => {});
      await handleMessage(from, toRun, progress, queued, _inboundMessageId);
      return;
    }

    const pending = await peekContinueMessage(from, userId);
    if (pending) {
      const options = await listWorkspacePickerOptions(userId);
      const names = options.map((m) => `• *${m.workspace.name.trim()}*`).join("\n");
      await sendWhatsAppText(
        from,
        `Still waiting for a workspace pick.\n\nTap *Pick workspace* below, or reply with the exact name:\n${names}`
      );
      await sendWorkspacePicker(
        from,
        options.map((m) => m.workspace),
        "Before I continue, which workspace should this apply to?"
      );
      await recordExchange(userId, text, "[workspace picker reshown]").catch(() => {});
      return;
    }

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

  // Recent exchanges give the agent the context to resolve follow-ups like
  // "make that one high priority" (the prior reply names the task).
  const history = await getRecentConversation(userId);
  const activeCtx = hasWorkspace
    ? await resolveUserWorkspaceContext(userId)
    : { workspaceId: null, workspaceName: null };

  progress?.beginSlowPing(queued);

  // Persisted chat state first; mining previous replies is only a fallback
  // for conversations that predate the state table.
  const lastDiscussedTaskShortId =
    (await getLastDiscussedTask(userId, activeCtx.workspaceId)) ??
    lastTaskShortIdFromTurns(history);

  const session: WhatsAppSession = {
    phone: from,
    workspaceId: activeCtx.workspaceId,
    workspaceName: activeCtx.workspaceName,
    createdTaskShortIds: [],
    pendingDeleteShortId: null,
    pendingDemote: false,
    pendingRemoveMember: false,
    pendingDeleteAsset: false,
    whiteboardImages: null,
    lastCreatedTask: null,
    workspacePickerSent: false,
    userMessage: text,
    conversationTurns: history,
    lastDiscussedTaskShortId,
  };

  // Single agent (MCP-style): one capable model, full registry tools, no
  // triage router. The model composes inquiry answers; mutations use the
  // deterministic tool output.
  let loop: AgentLoopResult;
  try {
    loop = await runWhatsAppAgentLoop({
      anthropic: new Anthropic(),
      model: WHATSAPP_AGENT_MODEL,
      systemPrompt: buildSystemPrompt(activeCtx.workspaceName),
      tools: buildWhatsAppHaikuTools(TOOLS) ?? TOOLS,
      messages: [...history, { role: "user" as const, content: text }],
      maxTurns: MAX_TOOL_TURNS,
      runTool: (name, input) => executeAction(userId, name, input, session),
      onProgress: (action, result) => progress?.step(action, result),
    });
  } finally {
    progress?.finish();
  }

  const { actionResults, assistantNote, budgetExhausted } = loop;
  let reply = loop.reply;

  const withMessage = actionResults.filter((o) => o.message.trim());
  const staticFallback =
    "Tell me what to add or change on your board — or send *menu*.";

  if (withMessage.length > 0) {
    // Inquiry outputs that only served to resolve a task for a mutation are
    // intermediate context — the user gets the confirmation, not the lookup.
    const replyOutcomes = pickReplyOutcomes(actionResults);
    const toolFallback = formatWhatsAppUserReply(
      replyOutcomes,
      budgetExhausted,
      null
    );
    const inquiryOnly = withMessage.every(
      (o) => o.action && INQUIRY_TOOLS.has(o.action)
    );
    // Inquiries: the model's composed answer wins (it read the tool results).
    // Mutations: the deterministic confirmation wins — no restating by the model.
    const draft =
      inquiryOnly && assistantNote?.trim() ? assistantNote : toolFallback;
    reply = guardWhatsAppReply({ draft, toolFallback, actionResults });
  } else if (reply) {
    reply = guardWhatsAppReply({
      draft: reply,
      toolFallback: reply,
      actionResults,
    });
  } else if (!session.workspacePickerSent) {
    reply = staticFallback;
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

  // Tools update session.lastDiscussedTaskShortId as they run; persist it so
  // the next message resolves "post that" without re-parsing chat history.
  if (
    session.lastDiscussedTaskShortId &&
    session.lastDiscussedTaskShortId !== lastDiscussedTaskShortId
  ) {
    await setLastDiscussedTask(
      userId,
      session.workspaceId,
      session.lastDiscussedTaskShortId
    ).catch((err) =>
      console.error("Failed to persist chat state:", err)
    );
  }

  await sendPostActionFollowUps(from, userId, text, session);
}

/**
 * Tool execution lives in the shared registry (lib/tools/registry.ts) —
 * one ToolDef per tool drives WhatsApp schemas, MCP registrations, and
 * this dispatch. Returns a structured outcome; success is never inferred
 * from message text.
 */
async function executeAction(
  userId: string,
  action: string,
  input: { workspace?: string; [key: string]: unknown },
  session: WhatsAppSession
): Promise<{ ok: boolean; message: string }> {
  return dispatchWhatsAppTool(action, input, { userId, session });
}
