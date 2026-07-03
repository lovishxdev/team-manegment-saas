import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  TaskPriority,
  TaskStatus,
  Role,
} from "@/lib/generated/prisma/client";
import { getUserIdByPhone } from "@/lib/identity-cache";
import {
  assetFileName,
  attachAssetToTask,
  createTask,
  deleteTask,
  getBoardState,
  getTask,
  listAssets,
  resolveUserWorkspaceContext,
  ServiceError,
  resolveBatchAwareTaskShortId,
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
import { findOrCreateWorkspaceByName, getWorkspaceMembers, renameWorkspace, acceptInvite, promoteMember, demoteMemberById, resolveWorkspaceMember, formatMemberRole } from "@/lib/services/workspace";
import { displayUser } from "@/lib/username";
import {
  createWorkspaceInviteLink,
  formatInviteMembersResult,
  inviteMembersToWorkspace,
  MAX_BATCH_INVITES,
} from "@/lib/services/invites";
import {
  prepareDeleteAsset,
  prepareRemoveMember,
  runDeleteAssetConfirmed,
  runDeleteLink,
  runAddTaskUpdate,
  runBulkUpdateTasks,
  runCreateCategory,
  runExportWhiteboard,
  runLeaveWorkspace,
  runListCategories,
  runListMyTasks,
  runListTaskUpdates,
  runListWorkspaces,
  runPinLink,
  runReadAsset,
  runRemoveMemberConfirmed,
  runSearchTasks,
  runSwitchWorkspace,
  runUnassignTask,
  runUpdateLink,
  runWorkspaceSummary,
  MAX_BULK_TASK_UPDATES,
} from "@/lib/bot/extended-tools";
import { getRecentTaskUpdates } from "@/lib/services/task-updates";
import { sendWhatsAppImageBuffer } from "@/lib/whatsapp-media";
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
  formatTaskDetail,
  formatTaskSummary,
  formatWorkspaceMemberList,
  mapBoardSnapshot,
  type ActionOutcome,
} from "@/lib/channel-formatters";
import { classifyActionOutcome } from "@/lib/whatsapp-action-outcome";
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
  stageDeleteTask,
  stageDemoteMember,
  stageRemoveMember,
  stageDeleteAsset,
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
- create_task: when they want to add/create a task. Use a SHORT title (a few words, under ~80 chars). Put bullet lists, long paragraphs, SEO keywords, and detailed requirements in description — never dump them all into title.
- update_task: when they want to change a task - move/complete/start it, retitle it, set priority, due date, tags, or assign it (they usually reference it as #N)
- read_task: when they ask for details about a specific task (#N), or about one field on a task (tags, assignees, due date, status, description, priority, category, attachments, updates). Always call this tool — then answer only what they asked unless they wanted the full task.
- add_task_update: when they report a blocker, question, status note, or review feedback on a specific task (#N). Use for live team communication on that task — not for editing the task description.
- list_task_updates: when they ask what's happening on a task, what's pending, blockers, or the conversation history on #N. Use this for full update history; read_task includes only recent updates.
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
- search_tasks: when they want to find tasks by tag, category, status, assignee, priority, due date, or title keywords
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

Rules:
- Images/documents sent directly in WhatsApp (not via this text tool) are saved as assets automatically. Caption text becomes comma-separated tags; #N in the caption attaches the file to task #N. Tell users they can tag on upload by adding a caption like "booth, banner" or "#42 booth".
- You CAN tag and label uploaded files via update_asset_tags. Never claim you lack that capability.
- Conversation history is context only, never proof of completion. Every actionable request - even one identical to an earlier message - must be executed with fresh tool calls in THIS turn. Never claim something was created, updated, or deleted unless a tool result in this turn confirms it.
- Compound requests need multiple tool calls: execute them one step at a time, using each result before the next call. E.g. "create a workspace and add 3 tasks" = create_workspace first, then create_task three times. Always pass the workspace name on every tool after create_workspace in the same request.
- When the user says "task 1", "task 2", etc. referring to tasks they just asked you to create in THIS message, they mean the 1st/2nd/... task created in this request — use the #N shortId from each create_task tool result, NOT the literal number N. But "previous task", "the other task", or a task named by title (e.g. "go to the gym") always means an EXISTING task from before the new creates — look up its #N via get_board_state or use the title match; never mark a newly created task done when they asked about a previous one.
- "Previous task" / "the task before" / a task referenced by title is NEVER the task you just created in the same message unless they explicitly mean the new one.
- After all actions are done, reply with ONE short summary of everything that happened (no markdown, plain WhatsApp text). Do not send multiple summaries. If a tool returned an error, say so — never claim success for failed steps.
- Compound requests (multiple things in one message): call a tool for every actionable part. If you cannot do a part (missing info, no matching task, ambiguous target), do NOT skip silently — either let the tool fail with a clear error, or end your turn with a short note listing what could NOT be done and why (e.g. "Could not attach image: no task specified").
- Infer category from context (e.g. marketing, ops, frontend) only when clear; otherwise omit it.
- Infer priority only when stated or strongly implied (e.g. "urgent" = HIGH); otherwise omit it.
- Resolve relative due dates ("Friday", "tomorrow", "next week") to a concrete YYYY-MM-DD date using today's date above.
- "assign to me" means assignee "me"; multiple people can be assigned via the assignees array (e.g. ["me", "aarav"]).
- Use the conversation history to resolve references: "that task" / "it" usually means the task #N mentioned in your most recent reply.
- If the user names a specific workspace/project that is NOT "${activeWorkspaceName}", pass it as the workspace parameter; otherwise always omit workspace.
- If the message is NOT an actionable board request (greetings, questions, chit-chat), do not call a tool. Reply with one short, friendly sentence telling them what you can do.
- Task description = stable requirements/spec. Task updates = chronological team notes (blockers, questions, review feedback).
- After read_task, answer only the part the user asked for (e.g. just tags or just assignees) unless they asked for full details.
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
        title: {
          type: "string",
          description:
            "Short task title only (brief label, ideally under 80 characters)",
        },
        description: {
          type: "string",
          description:
            "Longer details: bullet lists, paragraphs, requirements, keywords — put lengthy content here, not in title",
        },
        category: {
          type: "string",
          description:
            "Task category (e.g. Marketing, Backend). Creates a custom category if needed. Only if clearly implied.",
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
            "Single assignee: 'me' for the sender, or part of a member's name/email",
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description:
            "Multiple assignees: 'me', usernames, or parts of member names/emails",
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
        category: {
          type: "string",
          description: "New category name (creates it if missing)",
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
            "Single assignee: 'me', a member name/email, or empty string to clear all assignees",
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "Full replacement list of assignees",
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
    name: "read_task",
    description:
      "Get full details for one task by #N short ID. Use when the user asks about a task or a specific field (tags, assignees, due date, status, description, etc.).",
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
    name: "add_task_update",
    description:
      "Post a team update on a task (#N) — blockers, questions, review notes. Not for editing the task description.",
    input_schema: {
      type: "object",
      properties: {
        shortId: { type: "integer", description: "Task short ID (#N)" },
        body: {
          type: "string",
          description: "The update message (blocker, question, feedback, status note)",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["shortId", "body"],
    },
  },
  {
    name: "list_task_updates",
    description:
      "List all team updates on a task (#N) — blockers, questions, and follow-ups. Use when the user asks what's happening or pending on a task.",
    input_schema: {
      type: "object",
      properties: {
        shortId: { type: "integer", description: "Task short ID (#N)" },
        limit: {
          type: "integer",
          description: "Max updates to return (default 50)",
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
    name: "attach_asset_to_task",
    description:
      "Attach a previously uploaded file/photo to a task. Use when the user wants to add an existing upload to a task (not a new WhatsApp upload). Use latest=true for 'the image I uploaded' / 'last photo'.",
    input_schema: {
      type: "object",
      properties: {
        taskShortId: {
          type: "integer",
          description: "Task short ID (#N) to attach the file to",
        },
        latest: {
          type: "boolean",
          description:
            "Target the most recently uploaded asset (default for 'previous upload')",
        },
        fileName: {
          type: "string",
          description: "Part of the file name when not using latest",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["taskShortId"],
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
  {
    name: "invite_members",
    description: `Invite people to the workspace by username, email, or phone. Up to ${MAX_BATCH_INVITES} people per request. Sends WhatsApp Accept/Decline when possible; otherwise returns a link to share.`,
    input_schema: {
      type: "object",
      properties: {
        members: {
          type: "array",
          items: { type: "string" },
          description:
            "Usernames, emails, or phone numbers to invite (max 8)",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["members"],
    },
  },
  {
    name: "list_workspace_members",
    description: "List everyone in the workspace and their roles",
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
    name: "create_invite_link",
    description:
      "Create a generic invite link anyone can use to join the workspace (leaders/sub-leaders only)",
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
    name: "promote_member",
    description:
      "Promote a workspace member to sub-leader or leader. Leader only.",
    input_schema: {
      type: "object",
      properties: {
        member: {
          type: "string",
          description: "Username, email, or name of the member to promote",
        },
        role: {
          type: "string",
          enum: ["SUB_LEADER", "LEADER"],
          description: "New role (default SUB_LEADER)",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["member"],
    },
  },
  {
    name: "demote_member",
    description:
      "Demote a workspace member to member or sub-leader. Leader only. Sends Confirm/Cancel buttons before applying.",
    input_schema: {
      type: "object",
      properties: {
        member: {
          type: "string",
          description: "Username, email, or name of the member to demote",
        },
        role: {
          type: "string",
          enum: ["MEMBER", "SUB_LEADER"],
          description: "New role (default MEMBER)",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["member"],
    },
  },
  {
    name: "list_my_tasks",
    description: "List open tasks assigned to the user",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "Filter: TODO, IN_PROGRESS, DONE, or OPEN (todo + in progress). Default OPEN.",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
    },
  },
  {
    name: "search_tasks",
    description:
      "Search/filter tasks by title, tag, category, status, assignee, priority, or due date",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search title or description" },
        tag: { type: "string", description: "Exact tag label" },
        category: { type: "string", description: "Category name" },
        status: {
          type: "string",
          description: "TODO, IN_PROGRESS, DONE, or OPEN",
        },
        assignee: {
          type: "string",
          description: "Username or email of assignee",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
        },
        dueBefore: {
          type: "string",
          description: "Due on or before YYYY-MM-DD",
        },
        dueAfter: {
          type: "string",
          description: "Due on or after YYYY-MM-DD",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
    },
  },
  {
    name: "list_workspaces",
    description: "List all workspaces the user belongs to",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "switch_workspace",
    description: "Set the active workspace by name",
    input_schema: {
      type: "object",
      properties: {
        workspace: {
          type: "string",
          description: "Workspace name to switch to",
        },
      },
      required: ["workspace"],
    },
  },
  {
    name: "workspace_summary",
    description:
      "Quick workspace overview: members, open tasks, assigned to you, status counts",
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
    name: "read_asset",
    description:
      "Get details for one uploaded file (use latest=true for last upload, or fileName)",
    input_schema: {
      type: "object",
      properties: {
        latest: { type: "boolean", description: "Most recent upload" },
        fileName: {
          type: "string",
          description: "Part of the file name",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
    },
  },
  {
    name: "delete_asset",
    description:
      "Delete an uploaded file. Sends Confirm/Cancel buttons before applying.",
    input_schema: {
      type: "object",
      properties: {
        latest: { type: "boolean" },
        fileName: { type: "string" },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
    },
  },
  {
    name: "delete_link",
    description: "Delete a saved link by title or URL fragment",
    input_schema: {
      type: "object",
      properties: {
        link: { type: "string", description: "Link title or URL to match" },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["link"],
    },
  },
  {
    name: "update_link",
    description: "Update a saved link's title, URL, description, or pin",
    input_schema: {
      type: "object",
      properties: {
        link: { type: "string", description: "Link title to find" },
        newTitle: { type: "string" },
        url: { type: "string" },
        description: { type: "string" },
        pinned: { type: "boolean" },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["link"],
    },
  },
  {
    name: "pin_link",
    description: "Pin or unpin a saved link",
    input_schema: {
      type: "object",
      properties: {
        link: { type: "string", description: "Link title to find" },
        pinned: { type: "boolean", description: "false to unpin" },
        unpin: { type: "boolean", description: "Set true to unpin" },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["link"],
    },
  },
  {
    name: "remove_member",
    description:
      "Remove a member from the workspace (leader only). Sends Confirm/Cancel buttons.",
    input_schema: {
      type: "object",
      properties: {
        member: {
          type: "string",
          description: "Username, email, or name",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["member"],
    },
  },
  {
    name: "list_categories",
    description: "List all task categories in the workspace",
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
    name: "create_category",
    description: "Create a new task category in the workspace",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Category name (e.g. Legal)" },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "leave_workspace",
    description:
      "Leave the workspace. Fails if you are the only leader and other members remain.",
    input_schema: {
      type: "object",
      properties: {
        workspace: {
          type: "string",
          description: "Workspace to leave, only if not the active one",
        },
      },
    },
  },
  {
    name: "bulk_update_tasks",
    description: `Update many tasks at once (max ${MAX_BULK_TASK_UPDATES}). Select by shortIds, shortId range, category, tag, or assignee.`,
    input_schema: {
      type: "object",
      properties: {
        shortIds: {
          type: "array",
          items: { type: "integer" },
          description: "Task short IDs (#N) to update",
        },
        shortIdFrom: {
          type: "integer",
          description: "Range start (inclusive), e.g. 1 for #1–#4 with shortIdTo 4",
        },
        shortIdTo: { type: "integer", description: "Range end (inclusive)" },
        category: {
          type: "string",
          description: "Only tasks in this category",
        },
        tag: { type: "string", description: "Only tasks with this tag" },
        assignee: { type: "string", description: "Only tasks assigned to this member" },
        assignedToMe: {
          type: "boolean",
          description: "Only tasks assigned to the sender",
        },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
          description: "New status to set",
        },
        newCategory: {
          type: "string",
          description: "Move tasks to this category",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
          description: "New priority",
        },
        clearAssignees: {
          type: "boolean",
          description: "Remove all assignees from matched tasks",
        },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
    },
  },
  {
    name: "unassign_task",
    description: "Remove all assignees from a task (#N)",
    input_schema: {
      type: "object",
      properties: {
        shortId: { type: "integer", description: "Task short ID (#N)" },
        workspace: {
          type: "string",
          description: "Workspace name, only if the user explicitly mentioned one",
        },
      },
      required: ["shortId"],
    },
  },
  {
    name: "export_whiteboard",
    description:
      "Render and send screenshots of the workspace whiteboard (up to 5 images). Large boards are split into tiles.",
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
  pendingDemote: boolean;
  pendingRemoveMember: boolean;
  pendingDeleteAsset: boolean;
  whiteboardImages: Buffer[] | null;
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
      board: mapBoardSnapshot(state.board),
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
    const activated = await tryActivateWorkspaceFromText(userId, text);
    if (activated) {
      const pending = await consumeContinueMessage(from, userId);
      const toRun = pending ?? text;
      await recordExchange(
        userId,
        text,
        `Using *${activated.workspaceName}*, continuing your request.`
      ).catch(() => {});
      await handleMessage(from, toRun, progress, queued);
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
  const actionResults: ActionOutcome[] = [];
  let reply: string | null = null;
  let assistantNote: string | null = null;
  let budgetExhausted = true;
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
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      const note = textBlock?.text.trim() || null;
      if (actionResults.length === 0) {
        reply = note;
      } else if (note) {
        assistantNote = note;
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
      const outcome = classifyActionOutcome(toolUse.name, result);
      actionResults.push(outcome);
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

  const withMessage = actionResults.filter((o) => o.message.trim());

  if (withMessage.length > 0) {
    reply = formatActionSummary(
      actionResults,
      budgetExhausted,
      "whatsapp",
      assistantNote
    );
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

function resolveAssigneesHints(
  assignees: unknown,
  assignee: unknown,
  senderUserId: string
): string[] | undefined {
  if (Array.isArray(assignees)) {
    const hints: string[] = [];
    for (const raw of assignees) {
      const resolved = resolveAssigneeInput(raw, senderUserId);
      if (resolved) hints.push(resolved);
    }
    return hints;
  }
  const single = resolveAssigneeInput(assignee, senderUserId);
  if (single === undefined) return undefined;
  if (single === null) return [];
  return [single];
}

function resolveAssigneesUpdate(
  assignees: unknown,
  assignee: unknown,
  senderUserId: string
): string[] | null | undefined {
  if (assignees !== undefined) {
    if (!Array.isArray(assignees)) return undefined;
    if (assignees.length === 0) return [];
    const hints: string[] = [];
    for (const raw of assignees) {
      const resolved = resolveAssigneeInput(raw, senderUserId);
      if (resolved) hints.push(resolved);
    }
    return hints;
  }
  if (assignee !== undefined) {
    const single = resolveAssigneeInput(assignee, senderUserId);
    if (single === null) return [];
    if (single) return [single];
    return [];
  }
  return undefined;
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

    if (action === "list_workspaces") {
      return runListWorkspaces(userId, "whatsapp");
    }

    if (action === "switch_workspace") {
      const result = await runSwitchWorkspace(userId, input, "whatsapp");
      const switched = await resolveUserWorkspaceContext(
        userId,
        String(input.workspace ?? "")
      );
      session.workspaceId = switched.workspaceId;
      session.workspaceName = switched.workspaceName;
      revalidateUserWorkspaces(userId, switched.workspaceId);
      return result;
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
        const assigneeHints = resolveAssigneesHints(
          input.assignees,
          input.assignee,
          userId
        );
        const task = await createTask({
          workspaceId: ctx.workspaceId,
          title: String(input.title),
          description: input.description
            ? String(input.description)
            : undefined,
          category: input.category ? String(input.category) : undefined,
          priority: input.priority as TaskPriority | undefined,
          dueDate: parseInputDueDate(input.dueDate),
          tags: parseTagsInput(input.tags),
          assignees: assigneeHints,
          userId,
        });
        session.createdTaskShortIds.push(task.shortId);
        session.lastCreatedTask = {
          shortId: task.shortId,
          workspaceId: ctx.workspaceId,
        };
        const batchIndex = session.createdTaskShortIds.length;
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        waWebhookLog("task created", {
          workspaceId: ctx.workspaceId,
          workspaceName: ctx.workspaceName,
          shortId: task.shortId,
        });
        return (
          `Done. Created ${formatTaskSummary(task, ctx.workspaceName, "whatsapp")}` +
          formatTaskDeepLink(ctx.workspaceId, task.shortId, "whatsapp") +
          ` (batch task ${batchIndex}).`
        );
      }

      case "update_task": {
        const shortId = await resolveBatchAwareTaskShortId(
          ctx.workspaceId,
          Number(input.shortId),
          session.createdTaskShortIds
        );

        const assigneeUpdate = resolveAssigneesUpdate(
          input.assignees,
          input.assignee,
          userId
        );

        const task = await updateTask({
          workspaceId: ctx.workspaceId,
          shortId,
          userId,
          title: input.title ? String(input.title) : undefined,
          description: input.description
            ? String(input.description)
            : undefined,
          status: input.status as TaskStatus | undefined,
          category: input.category ? String(input.category) : undefined,
          priority: input.priority as TaskPriority | undefined,
          dueDate: parseInputDueDate(input.dueDate),
          tags: parseTagsInput(input.tags),
          assignees:
            assigneeUpdate === undefined ? undefined : assigneeUpdate,
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return (
          `Done. ${formatTaskSummary(task, ctx.workspaceName, "whatsapp")} is now ${task.status.replace("_", " ")}.` +
          formatTaskDeepLink(ctx.workspaceId, task.shortId, "whatsapp")
        );
      }

      case "read_task": {
        const shortId = await resolveBatchAwareTaskShortId(
          ctx.workspaceId,
          Number(input.shortId),
          session.createdTaskShortIds
        );
        const task = await getTask(ctx.workspaceId, userId, shortId);
        const recentUpdates = await getRecentTaskUpdates(
          ctx.workspaceId,
          userId,
          shortId,
          10
        );
        return formatTaskDetail(
          task,
          ctx.workspaceName,
          ctx.workspaceId,
          "whatsapp",
          recentUpdates
        );
      }

      case "add_task_update": {
        const shortId = await resolveBatchAwareTaskShortId(
          ctx.workspaceId,
          Number(input.shortId),
          session.createdTaskShortIds
        );
        const body = String(input.body ?? "").trim();
        if (!body) return "I need the update message to post.";
        const result = await runAddTaskUpdate(
          ctx,
          userId,
          shortId,
          body,
          "whatsapp"
        );
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return result;
      }

      case "list_task_updates": {
        const shortId = await resolveBatchAwareTaskShortId(
          ctx.workspaceId,
          Number(input.shortId),
          session.createdTaskShortIds
        );
        const limit =
          input.limit !== undefined ? Number(input.limit) : undefined;
        return runListTaskUpdates(
          ctx,
          userId,
          shortId,
          "whatsapp",
          limit
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
            board: mapBoardSnapshot(state.board),
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

      case "attach_asset_to_task": {
        const taskShortId = Number(input.taskShortId);
        if (!Number.isInteger(taskShortId) || taskShortId < 1) {
          return "Which task should I attach the file to? Use #N.";
        }
        const latest = input.latest === true;
        const fileName =
          typeof input.fileName === "string" ? input.fileName : undefined;
        const { asset, task } = await attachAssetToTask({
          workspaceId: ctx.workspaceId,
          userId,
          taskShortId,
          latest: latest || !fileName,
          fileName,
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        const name = assetFileName(asset.url);
        return `Attached "${name}" to #${task.shortId} *${task.title}* in ${ctx.workspaceName}.`;
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

      case "invite_members": {
        const raw = input.members;
        const members = Array.isArray(raw)
          ? raw.map((m) => String(m))
          : String(raw ?? "")
              .split(/[,;\n]+/)
              .map((m) => m.trim())
              .filter(Boolean);
        if (members.length === 0) {
          return "Who should I invite? Give usernames, emails, or phone numbers (up to 8 at once).";
        }
        const result = await inviteMembersToWorkspace({
          workspaceId: ctx.workspaceId,
          inviterUserId: userId,
          identifiers: members,
        });
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return formatInviteMembersResult(result, "whatsapp");
      }

      case "list_workspace_members": {
        const { members } = await getWorkspaceMembers(ctx.workspaceId, userId);
        return formatWorkspaceMemberList(ctx.workspaceName, members, "whatsapp");
      }

      case "create_invite_link": {
        const link = await createWorkspaceInviteLink(
          ctx.workspaceId,
          userId
        );
        return `Invite link for *${link.workspaceName}* (share with anyone):\n${link.url}`;
      }

      case "promote_member": {
        const member = String(input.member ?? "").trim();
        if (!member) return "Who should I promote?";
        const newRole =
          input.role === "LEADER" ? Role.LEADER : Role.SUB_LEADER;
        const updated = await promoteMember(
          ctx.workspaceId,
          userId,
          member,
          newRole
        );
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return `Promoted @${displayUser(updated.user)} to ${formatMemberRole(updated.role)} in ${ctx.workspaceName}.`;
      }

      case "demote_member": {
        const member = String(input.member ?? "").trim();
        if (!member) return "Who should I demote?";
        const newRole =
          input.role === "SUB_LEADER" ? Role.SUB_LEADER : Role.MEMBER;
        const target = await resolveWorkspaceMember(ctx.workspaceId, member);
        if (target.userId === userId) {
          return "You cannot demote yourself.";
        }
        if (target.role === newRole) {
          return `@${displayUser(target.user)} is already ${formatMemberRole(newRole)}.`;
        }
        const rank = { MEMBER: 0, SUB_LEADER: 1, LEADER: 2 };
        if (rank[newRole] >= rank[target.role]) {
          return "That is not a demotion — use promote_member instead.";
        }

        await stageDemoteMember(session.phone, userId, {
          workspaceId: ctx.workspaceId,
          workspaceName: ctx.workspaceName,
          targetUserId: target.userId,
          targetLabel: displayUser(target.user),
          currentRole: target.role,
          newRole,
        });
        session.pendingDemote = true;
        return `Ready to demote @${displayUser(target.user)} from ${formatMemberRole(target.role)} to ${formatMemberRole(newRole)}. I'll send Confirm / Cancel buttons next.`;
      }

      case "list_my_tasks":
        return runListMyTasks(ctx, userId, input, "whatsapp");

      case "search_tasks":
        return runSearchTasks(ctx, userId, input, "whatsapp");

      case "workspace_summary":
        return runWorkspaceSummary(ctx, userId, "whatsapp");

      case "read_asset":
        return runReadAsset(ctx, userId, input, "whatsapp");

      case "delete_asset": {
        const pending = await prepareDeleteAsset(ctx, userId, input);
        await stageDeleteAsset(session.phone, userId, pending);
        session.pendingDeleteAsset = true;
        return `Ready to delete file "${pending.fileName}". I'll send Confirm / Cancel buttons next.`;
      }

      case "delete_link":
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return runDeleteLink(ctx, userId, input, "whatsapp");

      case "update_link":
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return runUpdateLink(ctx, userId, input, "whatsapp");

      case "pin_link":
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return runPinLink(ctx, userId, input, "whatsapp");

      case "remove_member": {
        const member = String(input.member ?? "").trim();
        if (!member) return "Who should I remove from the workspace?";
        const pending = await prepareRemoveMember(ctx, userId, member);
        await stageRemoveMember(session.phone, userId, pending);
        session.pendingRemoveMember = true;
        return `Ready to remove @${pending.targetLabel} from ${ctx.workspaceName}. I'll send Confirm / Cancel buttons next.`;
      }

      case "list_categories":
        return runListCategories(ctx, "whatsapp");

      case "create_category": {
        const result = await runCreateCategory(ctx, input, "whatsapp");
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return result;
      }

      case "leave_workspace": {
        const result = await runLeaveWorkspace(ctx, userId, "whatsapp");
        session.workspaceId = null;
        session.workspaceName = null;
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return result;
      }

      case "bulk_update_tasks": {
        const result = await runBulkUpdateTasks(
          ctx,
          userId,
          input,
          "whatsapp"
        );
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return result;
      }

      case "unassign_task": {
        const shortId = await resolveBatchAwareTaskShortId(
          ctx.workspaceId,
          Number(input.shortId),
          session.createdTaskShortIds
        );
        const result = await runUnassignTask(
          ctx,
          userId,
          shortId,
          "whatsapp"
        );
        revalidateUserWorkspaces(userId, ctx.workspaceId);
        return result;
      }

      case "export_whiteboard": {
        const result = await runExportWhiteboard(ctx, userId, "whatsapp");
        if (result.images?.length) {
          session.whiteboardImages = result.images;
        }
        return result.text;
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
