import { z } from "zod";
import {
  createWorkspace,
  findOrCreateWorkspaceByName,
  renameWorkspace,
} from "@/lib/services/workspace";
import { assertCanWrite, resolveUserWorkspaceContext } from "@/lib/services/project";
import {
  runCreateCategory,
  runLeaveWorkspace,
  runListCategories,
  runListWorkspaces,
  runSwitchWorkspace,
  runWorkspaceSummary,
} from "@/lib/bot/extended-tools";
import {
  listWorkspacePickerOptions,
  sendWorkspacePicker,
} from "@/lib/whatsapp-workspace";
import { revalidateUserWorkspaces } from "@/lib/revalidate-nav";
import {
  ok,
  soft,
  requireWorkspace,
  type ToolDef,
} from "@/lib/tools/types";
import { str, workspaceParam } from "@/lib/tools/helpers";

const createWorkspaceTool: ToolDef = {
  name: "create_workspace",
  waDescription:
    "Create a brand-new workspace (project board). Only when the user clearly wants a new workspace, not a task.",
  mcpDescription:
    "Create a new workspace (project board). The user becomes its leader and it becomes their active workspace.",
  needsWorkspace: false,
  inputShape: {
    name: z.string().min(1).max(80).describe("Name for the new workspace"),
  },
  run: async (input, ctx) => {
    const name = str(input.name);
    if (!name) return soft("What should the new workspace be called?");

    if (ctx.wa) {
      // WhatsApp reuses an existing workspace with the same name rather than failing.
      const { workspace, created } = await findOrCreateWorkspaceByName(
        ctx.userId,
        name
      );
      ctx.wa.session.workspaceName = workspace.name;
      ctx.wa.session.workspaceId = workspace.id;
      revalidateUserWorkspaces(ctx.userId, workspace.id);
      return ok(
        created
          ? `Created workspace "${workspace.name}". You're its leader and it's now your active workspace. New tasks will land here unless you name another workspace.`
          : `Workspace "${workspace.name}" already exists. Using it as your active workspace for the rest of this request.`,
        { workspaceId: workspace.id, created }
      );
    }

    const workspace = await createWorkspace(ctx.userId, name);
    return ok(
      `Created workspace "${workspace.name}" - you're its leader and it's now your active workspace. New tasks will land here unless you name another workspace.`,
      { workspaceId: workspace.id, created: true }
    );
  },
};

const renameWorkspaceTool: ToolDef = {
  name: "rename_workspace",
  waDescription:
    "Rename an existing workspace. Only the workspace leader can rename it.",
  mcpDescription: "Rename a workspace. Only the workspace leader can rename it.",
  inputShape: {
    name: z.string().min(1).max(80).describe("New workspace name"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const name = str(input.name);
    if (!name) return soft("What should the workspace be renamed to?");
    const updated = await renameWorkspace(ws.workspaceId, ctx.userId, name);
    if (ctx.wa) {
      ctx.wa.session.workspaceName = updated.name;
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
      return ok(`Renamed workspace to *${updated.name}*.`);
    }
    return ok(`Renamed workspace to "${updated.name}".`);
  },
};

const listWorkspacesTool: ToolDef = {
  name: "list_workspaces",
  waDescription: "List all workspaces the user belongs to",
  needsWorkspace: false,
  inputShape: {},
  run: async (_input, ctx) => ok(await runListWorkspaces(ctx.userId, ctx.channel)),
};

const switchWorkspaceTool: ToolDef = {
  name: "switch_workspace",
  waDescription: "Set the active workspace by name",
  needsWorkspace: false,
  inputShape: {
    workspace: z.string().min(1).describe("Workspace name to switch to"),
  },
  run: async (input, ctx) => {
    const message = await runSwitchWorkspace(ctx.userId, input, ctx.channel);
    if (ctx.wa) {
      const switched = await resolveUserWorkspaceContext(
        ctx.userId,
        str(input.workspace)
      );
      ctx.wa.session.workspaceId = switched.workspaceId;
      ctx.wa.session.workspaceName = switched.workspaceName;
      revalidateUserWorkspaces(ctx.userId, switched.workspaceId);
    }
    return ok(message);
  },
};

const workspaceSummaryTool: ToolDef = {
  name: "workspace_summary",
  waDescription:
    "Quick workspace overview: members, open tasks, assigned to you, status counts",
  mcpDescription:
    "Quick workspace overview: members, open tasks, assigned to you",
  inputShape: { workspace: workspaceParam },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    return ok(await runWorkspaceSummary(ws, ctx.userId, ctx.channel));
  },
};

const showWorkspacePickerTool: ToolDef = {
  name: "show_workspace_picker",
  waDescription:
    "Send an interactive workspace picker in WhatsApp when the user wants to choose or switch which workspace/board to use. Use for 'choose workspace', 'which workspace am I on', 'switch workspace' — not when they named a target workspace for a specific action.",
  whatsappOnly: true,
  inputShape: {},
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    if (!ctx.wa) return soft("Workspace picker is only available on WhatsApp.");
    const session = ctx.wa.session;
    if (session.workspacePickerSent) return ok("");
    const options = await listWorkspacePickerOptions(ctx.userId);
    if (options.length === 0) {
      return soft(
        'You have no workspaces yet. Say: "create a workspace called My Team"'
      );
    }
    if (options.length <= 1) {
      return ok(`You only have one workspace (*${ws.workspaceName}*).`);
    }
    const sent = await sendWorkspacePicker(
      session.phone,
      options.map((m) => m.workspace),
      `You're on *${ws.workspaceName}*. Pick a workspace:`
    );
    if (sent) {
      session.workspacePickerSent = true;
      return ok("");
    }
    return soft("Could not send the workspace picker. Try again in a moment.");
  },
};

const listCategoriesTool: ToolDef = {
  name: "list_categories",
  waDescription: "List all task categories in the workspace",
  inputShape: { workspace: workspaceParam },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    return ok(await runListCategories(ws, ctx.channel));
  },
};

const createCategoryTool: ToolDef = {
  name: "create_category",
  waDescription: "Create a new task category in the workspace",
  mcpDescription: "Create a new task category (e.g. Legal, Ops)",
  inputShape: {
    name: z.string().min(1).max(32).describe("Category name (e.g. Legal)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    await assertCanWrite(ctx.userId, ws.workspaceId);
    const message = await runCreateCategory(ws, input, ctx.channel);
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    return ok(message);
  },
};

const leaveWorkspaceTool: ToolDef = {
  name: "leave_workspace",
  waDescription:
    "Leave the workspace. Fails if you are the only leader and other members remain.",
  mcpDescription:
    "Leave the workspace. Blocked if you are the only leader with other members still in the team.",
  inputShape: {
    workspace: workspaceParam,
  },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const message = await runLeaveWorkspace(ws, ctx.userId, ctx.channel);
    if (ctx.wa) {
      ctx.wa.session.workspaceId = null;
      ctx.wa.session.workspaceName = null;
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    }
    return ok(message);
  },
};

export const workspaceTools: ToolDef[] = [
  createWorkspaceTool,
  renameWorkspaceTool,
  listWorkspacesTool,
  switchWorkspaceTool,
  workspaceSummaryTool,
  showWorkspacePickerTool,
  listCategoriesTool,
  createCategoryTool,
  leaveWorkspaceTool,
];
