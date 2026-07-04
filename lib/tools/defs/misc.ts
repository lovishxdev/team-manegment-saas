import { runExportWhiteboard } from "@/lib/bot/extended-tools";
import {
  ok,
  requireWorkspace,
  type ToolDef,
} from "@/lib/tools/types";
import { workspaceParam } from "@/lib/tools/helpers";

const exportWhiteboardTool: ToolDef = {
  name: "export_whiteboard",
  waDescription:
    "Render and send screenshots of the workspace whiteboard (up to 5 images). Large boards are split into tiles.",
  mcpDescription:
    "Render screenshots of the workspace whiteboard (up to 5 tiles). Returns image URLs.",
  inputShape: { workspace: workspaceParam },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const result = await runExportWhiteboard(ws, ctx.userId, ctx.channel);
    if (ctx.wa && result.images?.length) {
      ctx.wa.session.whiteboardImages = result.images;
    }
    return ok(result.text);
  },
};

export const miscTools: ToolDef[] = [exportWhiteboardTool];
