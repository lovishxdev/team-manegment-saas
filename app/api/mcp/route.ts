import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { getUserIdByMcpToken } from "@/lib/identity-cache";
import { verifyOAuthAccessToken } from "@/lib/services/oauth";
import {
  createTask,
  deleteTask,
  getBoardState,
  listAssets,
  resolveUserWorkspaceContext,
  ServiceError,
  taskAssigneeUsers,
  updateTask,
} from "@/lib/services/project";
import { createWorkspace, renameWorkspace } from "@/lib/services/workspace";
import {
  createWorkspaceLink,
  listWorkspaceLinks,
} from "@/lib/services/links";
import {
  formatBoardState,
  formatAssetList,
  formatLinkList,
  formatTaskDeepLink,
  mapBoardSnapshot,
} from "@/lib/channel-formatters";
import { workspaceUrl } from "@/lib/app-url";
import { displayUser } from "@/lib/username";

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
      "delete_task",
      {
        description:
          "Permanently delete a task, identified by its short ID (the #N number on the board)",
        inputSchema: {
          shortId: z.number().int().positive().describe("Task short ID (#N)"),
          workspace: workspaceParam,
        },
      },
      async ({ shortId, workspace }, extra) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
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

export { authHandler as GET, authHandler as POST };
