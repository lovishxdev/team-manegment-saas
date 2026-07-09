import { z } from "zod";
import {
  assetFileName,
  attachAssetToTask,
  downloadAssetBuffer,
  getAsset,
  listAssets,
  updateAssetTagsByRef,
} from "@/lib/services/project";
import {
  createWorkspaceLink,
  listWorkspaceLinks,
} from "@/lib/services/links";
import {
  prepareDeleteAsset,
  runDeleteAssetConfirmed,
  runDeleteLink,
  runPinLink,
  runReadAsset,
  runSendAsset,
  runUpdateLink,
} from "@/lib/bot/extended-tools";
import { formatAssetList, formatLinkList } from "@/lib/channel-formatters";
import { recordUndoable } from "@/lib/services/action-log";
import { formatTaskRef } from "@/lib/whatsapp-task-ref";
import { stageDeleteAsset } from "@/lib/whatsapp-pending";
import { revalidateUserWorkspaces } from "@/lib/revalidate-nav";
import {
  ok,
  soft,
  requireWorkspace,
  type ToolDef,
} from "@/lib/tools/types";
import { optionalStr, str, workspaceParam } from "@/lib/tools/helpers";

const listAssetsTool: ToolDef = {
  name: "list_assets",
  waDescription:
    "List files/assets uploaded to the workspace (images, documents). Use only when they want to browse names — NOT when they ask to receive/send/download a file (use send_asset).",
  inputShape: { workspace: workspaceParam },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const assets = await listAssets(ws.workspaceId, ctx.userId);
    return ok(formatAssetList(ws.workspaceName, assets, ctx.channel));
  },
};

const attachAssetToTaskTool: ToolDef = {
  name: "attach_asset_to_task",
  waDescription:
    "Attach a previously uploaded file/photo to a task. Use when the user wants to add an existing upload to a task (not a new WhatsApp upload). Use latest=true for 'the image I uploaded' / 'last photo'.",
  mcpDescription:
    "Attach a previously uploaded file/photo to a task. Use latest=true for the most recent upload.",
  inputShape: {
    taskShortId: z
      .number()
      .int()
      .positive()
      .describe("Task short ID (#N) to attach the file to"),
    latest: z
      .boolean()
      .optional()
      .describe(
        "Target the most recently uploaded asset (default for 'previous upload')"
      ),
    fileName: z
      .string()
      .optional()
      .describe("Part of the file name when not using latest"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const taskShortId = Number(input.taskShortId);
    if (!Number.isInteger(taskShortId) || taskShortId < 1) {
      return soft("Which task should I attach this to? Say the task name.");
    }
    const latest = input.latest === true;
    const fileName = optionalStr(input.fileName);
    const { asset, task } = await attachAssetToTask({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      taskShortId,
      latest: latest || !fileName,
      fileName,
    });
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    const name = assetFileName(asset.url);
    return ok(
      ctx.channel === "whatsapp"
        ? `Attached "${name}" to ${formatTaskRef(task.title)}.`
        : `Attached "${name}" to task #${task.shortId} "${task.title}" in workspace "${ws.workspaceName}".`
    );
  },
};

const updateAssetTagsTool: ToolDef = {
  name: "update_asset_tags",
  waDescription:
    "Add, remove, or replace tags on an uploaded file, photo, or document in the workspace. REQUIRED for any request to tag, label, or categorize an existing upload. Use latest=true for 'last photo' / 'that file'. New uploads with captions are tagged automatically on upload — use this for follow-up tagging via text.",
  mcpDescription:
    "Add, remove, or replace tags on an uploaded file in the workspace",
  inputShape: {
    tags: z
      .array(z.string())
      .min(1)
      .describe("Tag labels to add, remove, or set"),
    mode: z
      .enum(["add", "remove", "set"])
      .optional()
      .describe(
        "Whether to add to existing tags, remove matching tags, or replace all tags. Default add."
      ),
    latest: z
      .boolean()
      .optional()
      .describe(
        "Target the most recently uploaded asset (use for 'last photo', 'that file', etc.)"
      ),
    fileName: z
      .string()
      .optional()
      .describe(
        "Part of the file name to match when not using latest (e.g. 'banner' for banner.png)"
      ),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const rawTags = input.tags;
    const tags = Array.isArray(rawTags)
      ? rawTags.map((t) => String(t))
      : String(rawTags ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
    if (tags.length === 0) return soft("Which tags should I apply?");

    const mode =
      input.mode === "set" || input.mode === "remove" ? input.mode : "add";
    const latest = input.latest === true;
    const fileName = optionalStr(input.fileName);

    const asset = await updateAssetTagsByRef({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      tags,
      mode,
      latest: latest || (!fileName && mode !== "set"),
      fileName,
    });
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    const name = assetFileName(asset.url);
    const tagLine = asset.tags.length > 0 ? asset.tags.join(", ") : "(none)";
    return ok(
      ctx.channel === "whatsapp"
        ? `Updated tags on "${name}" in ${ws.workspaceName}: ${tagLine}.`
        : `Updated tags on "${name}" in workspace "${ws.workspaceName}": ${tagLine}.`
    );
  },
};

const readAssetTool: ToolDef = {
  name: "read_asset",
  waDescription:
    "Get metadata for one uploaded file (use latest=true for last upload, or fileName). Does NOT send the file — use send_asset when they want it in chat.",
  mcpDescription: "Get details for one uploaded file",
  inputShape: {
    latest: z.boolean().optional().describe("Most recent upload"),
    fileName: z.string().optional().describe("Part of the file name"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    return ok(await runReadAsset(ws, ctx.userId, input, ctx.channel));
  },
};

const sendAssetTool: ToolDef = {
  name: "send_asset",
  waDescription:
    "Send an uploaded workspace file to the user in WhatsApp so they can download it ('send me the file', 'share the pdf', 'can you send that document'). Use latest=true for the only/recent upload, or fileName to match. Delivers the actual file — do not use list_assets for this.",
  whatsappOnly: true,
  inputShape: {
    latest: z
      .boolean()
      .optional()
      .describe(
        "Send the most recent upload (default when they say 'the file' and there's one)"
      ),
    fileName: z
      .string()
      .optional()
      .describe("Part of the file name when not using latest"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    if (!ctx.wa) return soft("File delivery is only available on WhatsApp.");
    return ok(
      await runSendAsset(ws, ctx.userId, input, ctx.channel, ctx.wa.session)
    );
  },
};

const deleteAssetTool: ToolDef = {
  name: "delete_asset",
  waDescription:
    "Delete an uploaded file. Sends Confirm/Cancel buttons before applying.",
  mcpDescription:
    "Delete an uploaded file. Preview first; call with confirm=true after user agrees.",
  inputShape: {
    latest: z.boolean().optional(),
    fileName: z.string().optional(),
    confirm: z.boolean().optional(),
    workspace: workspaceParam,
  },
  waInputShape: {
    latest: z.boolean().optional(),
    fileName: z.string().optional(),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const pending = await prepareDeleteAsset(ws, ctx.userId, input);

    if (ctx.wa) {
      await stageDeleteAsset(ctx.wa.session.phone, ctx.userId, pending);
      ctx.wa.session.pendingDeleteAsset = true;
      return ok(
        `I'll delete file "${pending.fileName}" — tap Confirm below.`,
        { staged: true }
      );
    }

    if (input.confirm !== true) {
      return ok(
        `Delete file "${pending.fileName}" from workspace "${ws.workspaceName}"?\n\n` +
          `Ask the user to confirm, then call delete_asset again with confirm=true.`,
        { staged: true }
      );
    }
    return ok(await runDeleteAssetConfirmed(pending, ctx.userId, ctx.channel));
  },
};

const addLinkTool: ToolDef = {
  name: "add_link",
  waDescription:
    "Save an important URL to the workspace Links tab (docs, Figma, staging sites, etc.)",
  mcpDescription:
    "Save an important URL to the workspace Links tab so the whole team can find it (docs, Figma, staging sites, etc.)",
  inputShape: {
    title: z.string().min(1).max(120).describe("Short label for the link"),
    url: z.string().min(1).describe("URL (http/https)"),
    description: z
      .string()
      .max(500)
      .optional()
      .describe("Optional note about what the link is for"),
    pinned: z
      .boolean()
      .optional()
      .describe("Pin to the top of the links list"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const title = str(input.title);
    const url = str(input.url);
    if (!title || !url) return soft("I need a title and URL to save a link.");
    const link = await createWorkspaceLink({
      workspaceId: ws.workspaceId,
      userId: ctx.userId,
      title,
      url,
      description: optionalStr(input.description),
      pinned: input.pinned === true,
    });
    const message = ctx.wa
      ? `Saved link *${link.title}*${link.pinned ? " (pinned)" : ""}:\n${link.url}` +
        (link.description ? `\n_${link.description}_` : "")
      : `Added link "${link.title}"${link.pinned ? " (pinned)" : ""} to workspace "${ws.workspaceName}": ${link.url}` +
        (link.description ? `\nNote: ${link.description}` : "");
    recordUndoable({
      userId: ctx.userId,
      workspaceId: ws.workspaceId,
      channel: ctx.wa ? "whatsapp" : "mcp",
      tool: "add_link",
      summary: ctx.wa ? `Saved link *${link.title}*` : `Added link "${link.title}"`,
      inverse: { kind: "delete_link", linkId: link.id, linkTitle: link.title },
    });
    if (ctx.wa) {
      revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    }
    return ok(message);
  },
};

const listLinksTool: ToolDef = {
  name: "list_links",
  waDescription:
    "List important URLs saved in the workspace Links tab (pinned links first)",
  inputShape: { workspace: workspaceParam },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const links = await listWorkspaceLinks(ws.workspaceId, ctx.userId);
    return ok(formatLinkList(ws.workspaceName, links, ctx.channel));
  },
};

const deleteLinkTool: ToolDef = {
  name: "delete_link",
  waDescription: "Delete a saved link by title or URL fragment",
  inputShape: {
    link: z.string().min(1).describe("Link title or URL to match"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    return ok(await runDeleteLink(ws, ctx.userId, input, ctx.channel));
  },
};

const updateLinkTool: ToolDef = {
  name: "update_link",
  waDescription: "Update a saved link's title, URL, description, or pin",
  mcpDescription: "Update a saved link",
  inputShape: {
    link: z.string().min(1).describe("Link title to find"),
    newTitle: z.string().optional(),
    url: z.string().optional(),
    description: z.string().optional(),
    pinned: z.boolean().optional(),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    return ok(await runUpdateLink(ws, ctx.userId, input, ctx.channel));
  },
};

const pinLinkTool: ToolDef = {
  name: "pin_link",
  waDescription: "Pin or unpin a saved link",
  inputShape: {
    link: z.string().min(1).describe("Link title to find"),
    pinned: z.boolean().optional().describe("false to unpin"),
    unpin: z.boolean().optional().describe("Set true to unpin"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    return ok(await runPinLink(ws, ctx.userId, input, ctx.channel));
  },
};

export const assetTools: ToolDef[] = [
  listAssetsTool,
  sendAssetTool,
  attachAssetToTaskTool,
  updateAssetTagsTool,
  readAssetTool,
  deleteAssetTool,
  addLinkTool,
  listLinksTool,
  deleteLinkTool,
  updateLinkTool,
  pinLinkTool,
];
