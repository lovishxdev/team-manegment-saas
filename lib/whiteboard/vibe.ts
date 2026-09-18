import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, anthropicKeySetupHint } from "@/lib/anthropic-env";
import { recordAIUsageRaw, recordAnthropicAIUsage } from "@/lib/memory/model-usage";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ServiceError } from "@/lib/services/project";
import {
  getExcalidrawState,
  saveExcalidrawState,
} from "@/lib/services/workspace";
import type { ExcalidrawPersistedState } from "@/lib/excalidraw-screenshots";
import {
  normalizeVibeDiagram,
  type VibeDiagram,
  type VibeMode,
} from "@/lib/whiteboard/diagram";
import {
  compileVibeDiagram,
  sceneBounds,
  type CompiledElement,
} from "@/lib/whiteboard/compile-elements";

const VIBE_MODEL =
  process.env.WHITEBOARD_VIBE_MODEL?.trim() || "claude-haiku-4-5";

const DIAGRAM_TOOL: Anthropic.Tool = {
  name: "emit_diagram",
  description:
    "Emit a structured whiteboard diagram. Keep it interview-clear: few boxes, labeled arrows, one idea per node.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
        description: "Optional short board title",
      },
      layout: {
        type: "string",
        enum: ["left-right", "top-down", "grid"],
        description:
          "left-right for pipelines/adapters; top-down for hierarchies; grid for peer lists",
      },
      nodes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: {
              type: "string",
              description: "Short stable id (snake or camel), referenced by edges",
            },
            label: {
              type: "string",
              description: "Human label shown in the box (short)",
            },
            kind: {
              type: "string",
              enum: ["box", "rounded", "diamond", "note"],
            },
          },
          required: ["id", "label"],
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            label: { type: "string" },
          },
          required: ["from", "to"],
        },
      },
    },
    required: ["nodes", "edges"],
  },
};

const SYSTEM = `You turn a natural-language whiteboard request into a clear diagram.

Rules:
- Prefer 4–12 nodes. Never more than 20.
- Short labels (2–5 words). No paragraphs inside boxes.
- Use edges for flow / dependency / "calls".
- For product architecture (adapters → registry → services → DB), use layout left-right.
- Decision points use kind=diamond. Side notes use kind=note.
- Always call emit_diagram. Do not explain in prose.`;

export type VibeWhiteboardResult = {
  title: string | null;
  nodeCount: number;
  edgeCount: number;
  mode: VibeMode;
  elementCount: number;
  boardPath: string;
  diagram: VibeDiagram;
};

function asPersistedState(raw: unknown): ExcalidrawPersistedState {
  if (raw && typeof raw === "object") return raw as ExcalidrawPersistedState;
  return {};
}

async function designDiagram(input: {
  prompt: string;
  workspaceId: string;
  userId: string;
  workspaceName: string;
}): Promise<VibeDiagram> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new ServiceError(anthropicKeySetupHint(), "INVALID_INPUT");
  }

  const anthropic = new Anthropic({ apiKey });
  const started = Date.now();
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: VIBE_MODEL,
      max_tokens: 1800,
      temperature: 0.2,
      system: SYSTEM,
      tools: [DIAGRAM_TOOL],
      tool_choice: { type: "tool", name: "emit_diagram" },
      messages: [
        {
          role: "user",
          content: `Workspace: ${input.workspaceName}\n\nDraw this on the whiteboard:\n${input.prompt}`,
        },
      ],
    });
  } catch (err) {
    await recordAIUsageRaw({
      workspaceId: input.workspaceId,
      userId: input.userId,
      feature: "whiteboard",
      operation: "vibe",
      provider: "anthropic",
      model: VIBE_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - started,
      status: "ERROR",
      errorCode: err instanceof Error ? err.name : "unknown",
    }).catch(() => {});
    throw err;
  }

  await recordAnthropicAIUsage({
    workspaceId: input.workspaceId,
    userId: input.userId,
    feature: "whiteboard",
    operation: "vibe",
    model: VIBE_MODEL,
    response,
    durationMs: Date.now() - started,
  }).catch(() => {});

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolBlock) {
    throw new ServiceError(
      "Diagram model did not return a diagram — try again",
      "INVALID_INPUT"
    );
  }

  const diagram = normalizeVibeDiagram(toolBlock.input);
  if (diagram.nodes.length === 0) {
    throw new ServiceError(
      "Diagram came back empty — try a more concrete prompt",
      "INVALID_INPUT"
    );
  }
  return diagram;
}

async function broadcastScene(
  workspaceId: string,
  elements: CompiledElement[]
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const channel = admin.channel(`whiteboard-${workspaceId}`, {
      config: { private: true, broadcast: { self: false } },
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("whiteboard broadcast subscribe timeout"));
      }, 4000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(`whiteboard broadcast ${status}`));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: "scene",
      payload: { elements },
    });
    await admin.removeChannel(channel);
  } catch {
    // Live peers can refresh; persistence already succeeded.
  }
}

/**
 * Natural-language → structured diagram → Excalidraw scene on the workspace
 * whiteboard. Shared by WhatsApp, MCP, web chat, and the whiteboard UI.
 */
export async function vibeWhiteboard(input: {
  workspaceId: string;
  userId: string;
  prompt: string;
  mode?: VibeMode;
}): Promise<VibeWhiteboardResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new ServiceError(
      "Describe what to draw on the whiteboard",
      "INVALID_INPUT"
    );
  }
  if (prompt.length > 4000) {
    throw new ServiceError(
      "Prompt is too long — keep it under 4000 characters",
      "INVALID_INPUT"
    );
  }

  const mode: VibeMode = input.mode === "append" ? "append" : "replace";
  const workspace = await getExcalidrawState(input.workspaceId, input.userId);
  const existing = asPersistedState(workspace.excalidrawState);
  const existingElements = Array.isArray(existing.elements)
    ? existing.elements
    : [];

  const diagram = await designDiagram({
    prompt,
    workspaceId: input.workspaceId,
    userId: input.userId,
    workspaceName: workspace.name,
  });

  let compiled: CompiledElement[];
  let nextElements: unknown[];

  if (mode === "append" && existingElements.length > 0) {
    const { maxY } = sceneBounds(existingElements);
    compiled = compileVibeDiagram(diagram, {
      offsetX: 40,
      offsetY: maxY + 120,
      indexStart: existingElements.length + 1,
    });
    nextElements = [...existingElements, ...compiled];
  } else {
    compiled = compileVibeDiagram(diagram);
    nextElements = compiled;
  }

  const nextState: ExcalidrawPersistedState = {
    elements: nextElements,
    appState: {
      ...(existing.appState ?? {}),
      viewBackgroundColor:
        (existing.appState?.viewBackgroundColor as string | undefined) ??
        "#ffffff",
    },
    files: existing.files ?? null,
  };

  await saveExcalidrawState(input.workspaceId, input.userId, nextState);
  await broadcastScene(input.workspaceId, nextElements as CompiledElement[]);

  return {
    title: diagram.title ?? null,
    nodeCount: diagram.nodes.length,
    edgeCount: diagram.edges.length,
    mode,
    elementCount: compiled.length,
    boardPath: `/w/${input.workspaceId}/whiteboard`,
    diagram,
  };
}
