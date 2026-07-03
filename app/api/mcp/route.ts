import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { getUserIdByMcpToken } from "@/lib/identity-cache";
import { verifyOAuthAccessToken } from "@/lib/services/oauth";
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
  taskAssigneeUsers,
  updateAssetTagsByRef,
  updateTask,
} from "@/lib/services/project";
import {
  createWorkspace,
  getWorkspaceMembers,
  renameWorkspace,
  promoteMember,
  demoteMember,
  resolveWorkspaceMember,
  formatMemberRole,
} from "@/lib/services/workspace";
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
import {
  createWorkspaceLink,
  listWorkspaceLinks,
} from "@/lib/services/links";
import {
  formatBoardState,
  formatAssetList,
  formatLinkList,
  formatTaskDetail,
  formatWorkspaceMemberList,
  mapBoardSnapshot,
} from "@/lib/channel-formatters";
import { workspaceUrl } from "@/lib/app-url";
import { displayUser } from "@/lib/username";
import { Role } from "@/lib/generated/prisma/client";

/**
 * Claude App Remote MCP connector (Streamable HTTP transport).
 *
 * Auth: `Authorization: Bearer <User.mcpToken>`. The token identifies the
 * user directly -- MCP never touches signup/login flows. Each tool resolves
 * the target workspace from an optional `workspace` hint, falling back to
 * the user's most recently active workspace.
 */

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const workspaceParam = z
  .string()
  .optional()
  .describe(
    "Workspace name or ID. Omit to use the user's most recently active workspace."
  );

const dueDateParam = z
  .string()
  .optional()
  .describe(
    "Due date as YYYY-MM-DD. Resolve relative dates (e.g. 'Friday') to a concrete date before calling."
  );

const assigneeParam = z
  .string()
  .optional()
  .describe("Single assignee: username, email, or part of it");

const assigneesParam = z
  .array(z.string())
  .optional()
  .describe("Multiple assignees: usernames, emails, or member names");

function parseDueDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === "") return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    throw new ServiceError(`Invalid due date: "${value}"`, "INVALID_INPUT");
  }
  return parsed;
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function toolError(err: unknown) {
  const message =
    err instanceof ServiceError
      ? err.message
      : "Something went wrong executing this tool";
  return { ...text(message), isError: true };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "create_workspace",
      {
        description:
          "Create a new workspace (project board). The user becomes its leader and it becomes their active workspace.",
        inputSchema: {
          name: z.string().min(1).max(80).describe("Workspace name"),
        },
      },
      async ({ name }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const workspace = await createWorkspace(userId, name.trim());
          return text(
            `Created workspace "${workspace.name}" - you're its leader and it's now your active workspace. New tasks will land here unless you name another workspace.`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "rename_workspace",
      {
        description: "Rename a workspace. Only the workspace leader can rename it.",
        inputSchema: {
          name: z.string().min(1).max(80).describe("New workspace name"),
          workspace: workspaceParam,
        },
      },
      async ({ name, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const updated = await renameWorkspace(ctx.workspaceId, userId, name);
          return text(`Renamed workspace to "${updated.name}".`);
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "create_task",
      {
        description: "Create a new task on the project board",
        inputSchema: {
          title: z.string().min(1).describe("Task title"),
          description: z.string().optional().describe("Longer task details"),
          category: z
            .string()
            .optional()
            .describe(
              "Task category (e.g. Marketing, Ops). Creates a custom category if it does not exist. Defaults to General."
            ),
          priority: z
            .enum(PRIORITIES)
            .optional()
            .describe("Priority (defaults to MEDIUM)"),
          dueDate: dueDateParam,
          tags: z
            .array(z.string())
            .optional()
            .describe("Free-form labels, e.g. ['marketing', 'v2']"),
          assignee: assigneeParam,
          assignees: assigneesParam,
          workspace: workspaceParam,
        },
      },
      async (
        {
          title,
          description,
          category,
          priority,
          dueDate,
          tags,
          assignee,
          assignees,
          workspace,
        },
        extra
      ) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const task = await createTask({
            workspaceId: ctx.workspaceId,
            title,
            description,
            category,
            priority,
            dueDate: parseDueDate(dueDate),
            tags,
            assignee,
            assignees,
            userId,
          });
          const assigneeNames = taskAssigneeUsers(task)
            .map((u) => displayUser(u))
            .join(", ");
          return text(
            `Created task #${task.shortId} "${task.title}" (${task.category.name}, ${task.priority}` +
              (task.dueDate
                ? `, due ${task.dueDate.toISOString().slice(0, 10)}`
                : "") +
              (assigneeNames ? `, assigned to ${assigneeNames}` : "") +
              `) in workspace "${ctx.workspaceName}".`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "update_task",
      {
        description:
          "Update any fields of an existing task, identified by its short ID (the #N number on the board). Only provided fields change.",
        inputSchema: {
          shortId: z.number().int().positive().describe("Task short ID (#N)"),
          title: z.string().optional().describe("New title"),
          description: z.string().optional().describe("New description"),
          status: z.enum(STATUSES).optional().describe("New status"),
          category: z
            .string()
            .optional()
            .describe("New category name (creates it if missing)"),
          priority: z.enum(PRIORITIES).optional().describe("New priority"),
          dueDate: dueDateParam.describe(
            "Due date as YYYY-MM-DD, or empty string to clear it"
          ),
          tags: z
            .array(z.string())
            .optional()
            .describe("Full replacement list of free-form labels"),
          assignee: assigneeParam.describe(
            "Single assignee username or email, or empty string to unassign all"
          ),
          assignees: assigneesParam.describe(
            "Full replacement list of assignees (usernames, emails, or ids)"
          ),
          workspace: workspaceParam,
        },
      },
      async (
        {
          shortId,
          title,
          description,
          status,
          category,
          priority,
          dueDate,
          tags,
          assignee,
          assignees,
          workspace,
        },
        extra
      ) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const task = await updateTask({
            workspaceId: ctx.workspaceId,
            shortId,
            userId,
            title,
            description,
            status,
            category,
            priority,
            dueDate: parseDueDate(dueDate),
            tags,
            assignee: assignee === "" ? null : assignee,
            assignees,
          });
          const assigneeNames = taskAssigneeUsers(task)
            .map((u) => displayUser(u))
            .join(", ");
          return text(
            `Updated task #${task.shortId} "${task.title}": ${task.status}, ${task.category.name}, ${task.priority}` +
              (task.dueDate
                ? `, due ${task.dueDate.toISOString().slice(0, 10)}`
                : "") +
              (assigneeNames
                ? `, assigned to ${assigneeNames}`
                : ", unassigned") +
              ` (workspace "${ctx.workspaceName}").`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "read_task",
      {
        description:
          "Get full details for one task by short ID (#N). Use when the user asks about a task or a specific field (tags, assignees, due date, status, description, priority, category, attachments). Answer only what they asked unless they wanted everything.",
        inputSchema: {
          shortId: z.number().int().positive().describe("Task short ID (#N)"),
          workspace: workspaceParam,
        },
      },
      async ({ shortId, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const task = await getTask(ctx.workspaceId, userId, shortId);
          const recentUpdates = await getRecentTaskUpdates(
            ctx.workspaceId,
            userId,
            shortId,
            10
          );
          return text(
            formatTaskDetail(
              task,
              ctx.workspaceName,
              ctx.workspaceId,
              "mcp",
              recentUpdates
            )
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "delete_task",
      {
        description:
          "Permanently delete a task by short ID (#N). ALWAYS call once without confirm to preview, show the user what will be deleted, and ask them to confirm. Only call again with confirm=true after explicit user confirmation.",
        inputSchema: {
          shortId: z.number().int().positive().describe("Task short ID (#N)"),
          confirm: z
            .boolean()
            .optional()
            .describe(
              "Set true only after the user explicitly confirms deletion in chat"
            ),
          workspace: workspaceParam,
        },
      },
      async ({ shortId, confirm, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const state = await getBoardState(ctx.workspaceId, userId);
          const all = [
            ...state.board.TODO,
            ...state.board.IN_PROGRESS,
            ...state.board.DONE,
          ];
          const existing = all.find((t) => t.shortId === shortId);
          if (!existing) {
            return toolError(
              new ServiceError(
                `Task #${shortId} not found in workspace "${ctx.workspaceName}"`,
                "NOT_FOUND"
              )
            );
          }

          if (!confirm) {
            return text(
              `Delete task #${existing.shortId} "${existing.title}" from workspace "${ctx.workspaceName}"?\n\n` +
                `This cannot be undone. Ask the user to confirm, then call delete_task again with confirm=true.`
            );
          }

          const task = await deleteTask({
            workspaceId: ctx.workspaceId,
            shortId,
            userId,
          });
          return text(
            `Deleted task #${task.shortId} "${task.title}" from workspace "${ctx.workspaceName}".`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "list_assets",
      {
        description: "List files/assets uploaded to the workspace (images, documents)",
        inputSchema: {
          workspace: workspaceParam,
        },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const assets = await listAssets(ctx.workspaceId, userId);
          return text(formatAssetList(ctx.workspaceName, assets, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "add_link",
      {
        description:
          "Save an important URL to the workspace Links tab so the whole team can find it (docs, Figma, staging sites, etc.)",
        inputSchema: {
          title: z.string().min(1).max(120).describe("Short label for the link"),
          url: z.string().min(1).describe("URL (http/https; scheme optional)"),
          description: z
            .string()
            .max(500)
            .optional()
            .describe("Optional note about what the link is for"),
          pinned: z
            .boolean()
            .optional()
            .describe("Pin to the top of the links list (defaults to false)"),
          workspace: workspaceParam,
        },
      },
      async ({ title, url, description, pinned, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const link = await createWorkspaceLink({
            workspaceId: ctx.workspaceId,
            userId,
            title,
            url,
            description,
            pinned,
          });
          return text(
            `Added link "${link.title}"${link.pinned ? " (pinned)" : ""} to workspace "${ctx.workspaceName}": ${link.url}` +
              (link.description ? `\nNote: ${link.description}` : "")
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "list_links",
      {
        description:
          "List important URLs saved in the workspace Links tab (pinned links first)",
        inputSchema: {
          workspace: workspaceParam,
        },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const links = await listWorkspaceLinks(ctx.workspaceId, userId);
          return text(formatLinkList(ctx.workspaceName, links, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "attach_asset_to_task",
      {
        description:
          "Attach a previously uploaded file/photo to a task. Use latest=true for the most recent upload.",
        inputSchema: {
          taskShortId: z
            .number()
            .int()
            .positive()
            .describe("Task short ID (#N)"),
          latest: z
            .boolean()
            .optional()
            .describe("Attach the most recently uploaded asset"),
          fileName: z
            .string()
            .optional()
            .describe("Part of the file name when not using latest"),
          workspace: workspaceParam,
        },
      },
      async ({ taskShortId, latest, fileName, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const { asset, task } = await attachAssetToTask({
            workspaceId: ctx.workspaceId,
            userId,
            taskShortId,
            latest: latest === true || !fileName,
            fileName,
          });
          const name = assetFileName(asset.url);
          return text(
            `Attached "${name}" to task #${task.shortId} "${task.title}" in workspace "${ctx.workspaceName}".`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "update_asset_tags",
      {
        description:
          "Add, remove, or replace tags on an uploaded file in the workspace",
        inputSchema: {
          tags: z.array(z.string()).min(1).describe("Tag labels"),
          mode: z
            .enum(["add", "remove", "set"])
            .optional()
            .describe("add (default), remove matching tags, or replace all"),
          latest: z
            .boolean()
            .optional()
            .describe("Target the most recently uploaded asset"),
          fileName: z
            .string()
            .optional()
            .describe("Part of the file name when not using latest"),
          workspace: workspaceParam,
        },
      },
      async ({ tags, mode, latest, fileName, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const asset = await updateAssetTagsByRef({
            workspaceId: ctx.workspaceId,
            userId,
            tags,
            mode: mode ?? "add",
            latest: latest === true || (!fileName && mode !== "set"),
            fileName,
          });
          const name = assetFileName(asset.url);
          const tagLine =
            asset.tags.length > 0 ? asset.tags.join(", ") : "(none)";
          return text(
            `Updated tags on "${name}" in workspace "${ctx.workspaceName}": ${tagLine}.`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "invite_members",
      {
        description: `Invite teammates by username, email, or phone. Up to ${MAX_BATCH_INVITES} per request. WhatsApp users in the 24h window get Accept/Decline buttons; others get a link to share.`,
        inputSchema: {
          members: z
            .array(z.string())
            .min(1)
            .max(MAX_BATCH_INVITES)
            .describe("Usernames, emails, or phone numbers"),
          workspace: workspaceParam,
        },
      },
      async ({ members, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const result = await inviteMembersToWorkspace({
            workspaceId: ctx.workspaceId,
            inviterUserId: userId,
            identifiers: members,
          });
          return text(formatInviteMembersResult(result, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "list_workspace_members",
      {
        description: "List everyone in the workspace and their roles",
        inputSchema: {
          workspace: workspaceParam,
        },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const { members } = await getWorkspaceMembers(
            ctx.workspaceId,
            userId
          );
          return text(
            formatWorkspaceMemberList(ctx.workspaceName, members, "mcp")
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "create_invite_link",
      {
        description:
          "Create a generic invite link anyone can use to join (leaders/sub-leaders only)",
        inputSchema: {
          workspace: workspaceParam,
        },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const link = await createWorkspaceInviteLink(
            ctx.workspaceId,
            userId
          );
          return text(
            `Invite link for "${link.workspaceName}" (share with anyone): ${link.url}`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "promote_member",
      {
        description:
          "Promote a workspace member to sub-leader or leader. Leader only.",
        inputSchema: {
          member: z
            .string()
            .min(1)
            .describe("Username, email, or name of the member"),
          role: z
            .enum(["SUB_LEADER", "LEADER"])
            .optional()
            .describe("New role (default SUB_LEADER)"),
          workspace: workspaceParam,
        },
      },
      async ({ member, role, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const newRole = role === "LEADER" ? Role.LEADER : Role.SUB_LEADER;
          const updated = await promoteMember(
            ctx.workspaceId,
            userId,
            member,
            newRole
          );
          return text(
            `Promoted @${displayUser(updated.user)} to ${formatMemberRole(updated.role)} in workspace "${ctx.workspaceName}".`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "demote_member",
      {
        description:
          "Demote a workspace member to member or sub-leader. Leader only. Call without confirm to preview; call again with confirm=true after the user explicitly agrees.",
        inputSchema: {
          member: z
            .string()
            .min(1)
            .describe("Username, email, or name of the member"),
          role: z
            .enum(["MEMBER", "SUB_LEADER"])
            .optional()
            .describe("New role (default MEMBER)"),
          confirm: z
            .boolean()
            .optional()
            .describe(
              "Set true only after the user explicitly confirms demotion in chat"
            ),
          workspace: workspaceParam,
        },
      },
      async ({ member, role, confirm, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const newRole = role === "SUB_LEADER" ? Role.SUB_LEADER : Role.MEMBER;
          const target = await resolveWorkspaceMember(ctx.workspaceId, member);

          if (!confirm) {
            return text(
              `Demote @${displayUser(target.user)} from ${formatMemberRole(target.role)} to ${formatMemberRole(newRole)} in workspace "${ctx.workspaceName}"?\n\n` +
                `Ask the user to confirm, then call demote_member again with confirm=true.`
            );
          }

          const updated = await demoteMember(
            ctx.workspaceId,
            userId,
            member,
            newRole
          );
          return text(
            `Demoted @${displayUser(updated.user)} to ${formatMemberRole(updated.role)} in workspace "${ctx.workspaceName}".`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "list_my_tasks",
      {
        description: "List open tasks assigned to the user",
        inputSchema: {
          status: z
            .string()
            .optional()
            .describe("TODO, IN_PROGRESS, DONE, or OPEN"),
          workspace: workspaceParam,
        },
      },
      async ({ status, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(
            await runListMyTasks(ctx, userId, { status }, "mcp")
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "search_tasks",
      {
        description:
          "Search tasks by title, tag, category, status, assignee, priority, or due date",
        inputSchema: {
          query: z.string().optional(),
          tag: z.string().optional(),
          category: z.string().optional(),
          status: z.string().optional(),
          assignee: z.string().optional(),
          priority: z.enum(PRIORITIES).optional(),
          dueBefore: z.string().optional(),
          dueAfter: z.string().optional(),
          workspace: workspaceParam,
        },
      },
      async (input, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(
            userId,
            input.workspace
          );
          return text(await runSearchTasks(ctx, userId, input, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "list_workspaces",
      {
        description: "List all workspaces the user belongs to",
        inputSchema: {},
      },
      async (_input, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          return text(await runListWorkspaces(userId, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "switch_workspace",
      {
        description: "Set the active workspace by name",
        inputSchema: {
          workspace: z.string().min(1).describe("Workspace name to switch to"),
        },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          return text(await runSwitchWorkspace(userId, { workspace }, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "workspace_summary",
      {
        description:
          "Quick workspace overview: members, open tasks, assigned to you",
        inputSchema: { workspace: workspaceParam },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(await runWorkspaceSummary(ctx, userId, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "read_asset",
      {
        description: "Get details for one uploaded file",
        inputSchema: {
          latest: z.boolean().optional(),
          fileName: z.string().optional(),
          workspace: workspaceParam,
        },
      },
      async (input, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(
            userId,
            input.workspace
          );
          return text(await runReadAsset(ctx, userId, input, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "delete_asset",
      {
        description:
          "Delete an uploaded file. Preview first; call with confirm=true after user agrees.",
        inputSchema: {
          latest: z.boolean().optional(),
          fileName: z.string().optional(),
          confirm: z.boolean().optional(),
          workspace: workspaceParam,
        },
      },
      async (input, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(
            userId,
            input.workspace
          );
          const pending = await prepareDeleteAsset(ctx, userId, input);
          if (!input.confirm) {
            return text(
              `Delete file "${pending.fileName}" from workspace "${ctx.workspaceName}"?\n\n` +
                `Ask the user to confirm, then call delete_asset again with confirm=true.`
            );
          }
          return text(
            await runDeleteAssetConfirmed(pending, userId, "mcp")
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "delete_link",
      {
        description: "Delete a saved link by title or URL fragment",
        inputSchema: {
          link: z.string().min(1),
          workspace: workspaceParam,
        },
      },
      async ({ link, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(await runDeleteLink(ctx, userId, { link }, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "update_link",
      {
        description: "Update a saved link",
        inputSchema: {
          link: z.string().min(1),
          newTitle: z.string().optional(),
          url: z.string().optional(),
          description: z.string().optional(),
          pinned: z.boolean().optional(),
          workspace: workspaceParam,
        },
      },
      async (input, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(
            userId,
            input.workspace
          );
          return text(await runUpdateLink(ctx, userId, input, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "pin_link",
      {
        description: "Pin or unpin a saved link",
        inputSchema: {
          link: z.string().min(1),
          pinned: z.boolean().optional(),
          unpin: z.boolean().optional(),
          workspace: workspaceParam,
        },
      },
      async (input, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(
            userId,
            input.workspace
          );
          return text(await runPinLink(ctx, userId, input, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "remove_member",
      {
        description:
          "Remove a member from the workspace (leader only). Preview first; confirm=true to apply.",
        inputSchema: {
          member: z.string().min(1),
          confirm: z.boolean().optional(),
          workspace: workspaceParam,
        },
      },
      async ({ member, confirm, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const pending = await prepareRemoveMember(
            ctx,
            userId,
            member
          );
          if (!confirm) {
            return text(
              `Remove @${pending.targetLabel} from workspace "${ctx.workspaceName}"?\n\n` +
                `Ask the user to confirm, then call remove_member again with confirm=true.`
            );
          }
          return text(
            await runRemoveMemberConfirmed(pending, userId, "mcp")
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "list_categories",
      {
        description: "List all task categories in the workspace",
        inputSchema: { workspace: workspaceParam },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(await runListCategories(ctx, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "create_category",
      {
        description: "Create a new task category (e.g. Legal, Ops)",
        inputSchema: {
          name: z.string().min(1).max(32).describe("Category name"),
          workspace: workspaceParam,
        },
      },
      async ({ name, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(await runCreateCategory(ctx, { name }, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "leave_workspace",
      {
        description:
          "Leave the workspace. Blocked if you are the only leader with other members still in the team.",
        inputSchema: { workspace: workspaceParam },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(await runLeaveWorkspace(ctx, userId, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "bulk_update_tasks",
      {
        description: `Update many tasks at once (max ${MAX_BULK_TASK_UPDATES}). Select by shortIds, range, category, tag, or assignee.`,
        inputSchema: {
          shortIds: z.array(z.number().int().positive()).optional(),
          shortIdFrom: z.number().int().positive().optional(),
          shortIdTo: z.number().int().positive().optional(),
          category: z.string().optional(),
          tag: z.string().optional(),
          assignee: z.string().optional(),
          assignedToMe: z.boolean().optional(),
          status: z.enum(STATUSES).optional().describe("New status"),
          newCategory: z.string().optional().describe("Move to category"),
          priority: z.enum(PRIORITIES).optional(),
          clearAssignees: z.boolean().optional(),
          workspace: workspaceParam,
        },
      },
      async (input, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(
            userId,
            input.workspace
          );
          return text(await runBulkUpdateTasks(ctx, userId, input, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "add_task_update",
      {
        description:
          "Post a team update on a task (#N) — blockers, questions, review notes. Not for editing the task description.",
        inputSchema: {
          shortId: z.number().int().positive().describe("Task short ID (#N)"),
          body: z.string().min(1).describe("Update message"),
          workspace: workspaceParam,
        },
      },
      async ({ shortId, body, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(
            await runAddTaskUpdate(ctx, userId, shortId, body, "mcp")
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "list_task_updates",
      {
        description:
          "List team updates on a task (#N) — blockers, questions, follow-ups. Use when the user asks what's happening or pending on a task.",
        inputSchema: {
          shortId: z.number().int().positive().describe("Task short ID (#N)"),
          limit: z
            .number()
            .int()
            .positive()
            .max(100)
            .optional()
            .describe("Max updates (default 50)"),
          workspace: workspaceParam,
        },
      },
      async ({ shortId, limit, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(
            await runListTaskUpdates(
              ctx,
              userId,
              shortId,
              "mcp",
              limit
            )
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "unassign_task",
      {
        description: "Remove all assignees from a task (#N)",
        inputSchema: {
          shortId: z.number().int().positive().describe("Task short ID"),
          workspace: workspaceParam,
        },
      },
      async ({ shortId, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          return text(await runUnassignTask(ctx, userId, shortId, "mcp"));
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "export_whiteboard",
      {
        description:
          "Render screenshots of the workspace whiteboard (up to 5 tiles). Returns image URLs.",
        inputSchema: { workspace: workspaceParam },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const result = await runExportWhiteboard(ctx, userId, "mcp");
          return text(result.text);
        } catch (err) {
          return toolError(err);
        }
      }
    );

    server.registerTool(
      "get_board_state",
      {
        description: "Get the current project board: all tasks grouped by status",
        inputSchema: {
          workspace: workspaceParam,
        },
      },
      async ({ workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const state = await getBoardState(ctx.workspaceId, userId);

          return text(
            formatBoardState(
              {
                workspaceId: ctx.workspaceId,
                workspaceName: ctx.workspaceName,
                board: mapBoardSnapshot(state.board),
                totalTasks: state.totalTasks,
              },
              "mcp"
            ) + `\n\nOpen: ${workspaceUrl(ctx.workspaceId)}`
          );
        } catch (err) {
          return toolError(err);
        }
      }
    );
  },
  {},
  { basePath: "/api" }
);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bearer-token verification. Two token kinds are accepted:
 *  1. Personal mcpToken (UUID) - copied manually from the settings page.
 *  2. OAuth access tokens - issued via the authorization flow used by
 *     claude.ai web/mobile connectors.
 * Returning undefined yields a 401 from mcp-handler, whose
 * WWW-Authenticate header points clients at the OAuth metadata.
 */
const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;

    if (UUID_REGEX.test(bearerToken)) {
      const userId = await getUserIdByMcpToken(bearerToken);
      if (!userId) return undefined;
      return {
        token: bearerToken,
        clientId: userId,
        scopes: ["tasks:read", "tasks:write"],
        extra: { userId },
      };
    }

    const oauth = await verifyOAuthAccessToken(bearerToken);
    if (!oauth) return undefined;
    return {
      token: bearerToken,
      clientId: oauth.clientId,
      scopes: ["tasks:read", "tasks:write"],
      extra: { userId: oauth.userId },
    };
  },
  { required: true }
);

export const maxDuration = 120;

export { authHandler as GET, authHandler as POST };
