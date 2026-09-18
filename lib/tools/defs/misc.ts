import { z } from "zod";
import { runExportWhiteboard } from "@/lib/bot/extended-tools";
import { ServiceError } from "@/lib/services/project";
import {
  ok,
  soft,
  requireWorkspace,
  type ToolDef,
} from "@/lib/tools/types";
import { optionalStr, str, workspaceParam } from "@/lib/tools/helpers";
import { getAppBaseUrl } from "@/lib/app-url";

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

const vibeWhiteboardTool: ToolDef = {
  name: "vibe_whiteboard",
  waDescription:
    "Draw or redraw the workspace Excalidraw whiteboard from a natural-language description (architecture, flow, system diagram). Use when they say vibe / draw / whiteboard / sketch / diagram this. Default replaces the board; pass mode=append to add beside existing drawings. After drawing, screenshots are sent automatically.",
  mcpDescription:
    "Generate or update the workspace Excalidraw whiteboard from a natural-language prompt (architecture diagrams, flows, interview boards). mode=replace (default) or append. Returns a short summary + board path; call export_whiteboard if you need screenshot URLs.",
  webDescription:
    "Draw or update the workspace whiteboard from a description (vibe whiteboarding).",
  inputShape: {
    prompt: z
      .string()
      .describe(
        "What to draw, e.g. 'Euclis architecture: WhatsApp, MCP, and Web as adapters over a shared tool registry and services layer'"
      ),
    mode: z
      .enum(["replace", "append"])
      .optional()
      .describe(
        "replace clears prior elements (default). append adds the new diagram below existing content."
      ),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const prompt = str(input.prompt);
    if (!prompt) {
      return soft("What should I draw on the whiteboard?");
    }
    const modeRaw = optionalStr(input.mode)?.toLowerCase();
    const mode = modeRaw === "append" ? "append" : "replace";

    try {
      // Lazy: vibe pulls Anthropic + server-only deps.
      const { vibeWhiteboard } = await import("@/lib/whiteboard/vibe");
      const result = await vibeWhiteboard({
        workspaceId: ws.workspaceId,
        userId: ctx.userId,
        prompt,
        mode,
      });

      const origin = getAppBaseUrl().replace(/\/$/, "");
      const url = `${origin}${result.boardPath}`;
      const titleBit = result.title ? ` “${result.title}”` : "";
      const modeBit = mode === "append" ? " (appended)" : "";

      if (ctx.channel === "whatsapp") {
        const exportResult = await runExportWhiteboard(
          ws,
          ctx.userId,
          ctx.channel
        );
        if (ctx.wa && exportResult.images?.length) {
          ctx.wa.session.whiteboardImages = exportResult.images;
        }
        return ok(
          `Drew${titleBit} on the *${ws.workspaceName}* whiteboard${modeBit} — ${result.nodeCount} boxes, ${result.edgeCount} links.\nOpen: ${url}`
        );
      }

      return ok(
        `Drew${titleBit} on the "${ws.workspaceName}" whiteboard${modeBit} (${result.nodeCount} nodes, ${result.edgeCount} edges, ${result.elementCount} elements).\nBoard: ${url}`,
        {
          title: result.title,
          nodeCount: result.nodeCount,
          edgeCount: result.edgeCount,
          mode: result.mode,
          boardPath: result.boardPath,
        }
      );
    } catch (err) {
      if (err instanceof ServiceError) return soft(err.message);
      throw err;
    }
  },
};

export const miscTools: ToolDef[] = [exportWhiteboardTool, vibeWhiteboardTool];
