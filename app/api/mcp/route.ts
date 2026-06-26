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
  updateTask,
} from "@/lib/services/project";
import { createWorkspace, renameWorkspace } from "@/lib/services/workspace";
import {
  createWorkspaceLink,
  listWorkspaceLinks,
} from "@/lib/services/links";
import { displayUser } from "@/lib/username";

/**
 * Claude App Remote MCP connector (Streamable HTTP transport).
 *
 * Auth: `Authorization: Bearer <User.mcpToken>`. The token identifies the
 * user directly -- MCP never touches signup/login flows. Each tool resolves
 * the target workspace from an optional `workspace` hint, falling back to
 * the user's most recently active workspace.
 */

const SCOPES = ["FRONTEND", "BACKEND", "DESIGN", "GENERAL"] as const;
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
  .describe("Assignee: a workspace member's username or email (or part of it)");

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
          scope: z
            .enum(SCOPES)
            .optional()
            .describe("Area of the task (defaults to GENERAL)"),
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
          workspace: workspaceParam,
        },
      },
      async (
        { title, description, scope, priority, dueDate, tags, assignee, workspace },
        extra
      ) => {
        const userId = extra.authInfo!.extra!.userId as string;
        try {
          const ctx = await resolveUserWorkspaceContext(userId, workspace);
          const task = await createTask({
            workspaceId: ctx.workspaceId,
            title,
            description,
            scope,
            priority,
            dueDate: parseDueDate(dueDate),
            tags,
            userId,
          });
          const final = assignee
            ? await updateTask({
                workspaceId: ctx.workspaceId,
                taskId: task.id,
                userId,
                assignee,
              })
            : task;
          return text(
            `Created task #${final.shortId} "${final.title}" (${final.scope}, ${final.priority}` +
              (final.dueDate
                ? `, due ${final.dueDate.toISOString().slice(0, 10)}`
                : "") +
              (final.assignedTo
                ? `, assigned to ${displayUser(final.assignedTo)}`
                : "") +
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
          scope: z.enum(SCOPES).optional().describe("New scope"),
          priority: z.enum(PRIORITIES).optional().describe("New priority"),
          dueDate: dueDateParam.describe(
            "Due date as YYYY-MM-DD, or empty string to clear it"
          ),
          tags: z
            .array(z.string())
            .optional()
            .describe("Full replacement list of free-form labels"),
          assignee: assigneeParam.describe(
            "Assignee username or email, or empty string to unassign"
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
          scope,
          priority,
          dueDate,
          tags,
          assignee,
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
            scope,
            priority,
            dueDate: parseDueDate(dueDate),
            tags,
            assignee: assignee === "" ? null : assignee,
          });
          return text(
            `Updated task #${task.shortId} "${task.title}": ${task.status}, ${task.scope}, ${task.priority}` +
              (task.dueDate
                ? `, due ${task.dueDate.toISOString().slice(0, 10)}`
                : "") +
              (task.assignedTo
                ? `, assigned to ${displayUser(task.assignedTo)}`
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
          if (assets.length === 0) {
            return text(`No assets in workspace "${ctx.workspaceName}" yet.`);
          }
          return text(
            `Assets in "${ctx.workspaceName}" (${assets.length}):\n` +
              assets
                .map(
                  (a) =>
                    `- ${a.url}\n  type: ${a.fileType}` +
                    (a.tags.length ? `, tags: ${a.tags.join(", ")}` : "") +
                    (a.uploadedBy ? `, by @${displayUser(a.uploadedBy)}` : "")
                )
                .join("\n")
          );
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
          if (links.length === 0) {
            return text(`No links saved in workspace "${ctx.workspaceName}" yet.`);
          }
          return text(
            `Links in "${ctx.workspaceName}" (${links.length}):\n` +
              links
                .map(
                  (link) =>
                    `- ${link.pinned ? "[pinned] " : ""}${link.title}\n  ${link.url}` +
                    (link.description ? `\n  note: ${link.description}` : "") +
                    `\n  by @${displayUser(link.createdBy)}`
                )
                .join("\n")
          );
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
          const { board, totalTasks } = await getBoardState(
            ctx.workspaceId,
            userId
          );

          const section = (label: string, tasks: (typeof board)["TODO"]) =>
            `${label} (${tasks.length})\n` +
            (tasks.length
              ? tasks
                  .map(
                    (t) =>
                      `  #${t.shortId} ${t.title} [${t.scope}, ${t.priority}]` +
                      (t.tags.length ? ` {${t.tags.join(", ")}}` : "") +
                      (t.dueDate
                        ? ` due ${t.dueDate.toISOString().slice(0, 10)}`
                        : "") +
                      (t.assignedTo
                        ? ` -> @${displayUser(t.assignedTo)}`
                        : "")
                  )
                  .join("\n")
              : "  (empty)");

          return text(
            `Board for "${ctx.workspaceName}" - ${totalTasks} task(s)\n\n` +
              [
                section("TODO", board.TODO),
                section("IN PROGRESS", board.IN_PROGRESS),
                section("DONE", board.DONE),
              ].join("\n\n")
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
