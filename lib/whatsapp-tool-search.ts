import type Anthropic from "@anthropic-ai/sdk";

/** Loaded immediately — no search round-trip for common task actions. */
export const WHATSAPP_CORE_TOOL_NAMES = new Set([
  "create_task",
  "update_task",
  "get_board_state",
  "ask_task",
  "add_task_update",
  "create_workspace",
]);

const TOOL_SEARCH_TOOL = {
  type: "tool_search_tool_bm25_20251119",
  name: "tool_search_tool_bm25",
} as const;

export function isWhatsAppToolSearchEnabled(): boolean {
  const flag = process.env.WHATSAPP_TOOL_SEARCH?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return true;
}

type DeferredTool = Anthropic.Tool & { defer_loading?: boolean };

/** Anthropic tool search: defer rare tools; core tools stay in context. */
export function buildWhatsAppHaikuTools(
  tools: Anthropic.Tool[]
): Anthropic.MessageCreateParams["tools"] {
  if (!isWhatsAppToolSearchEnabled()) {
    return tools;
  }

  const withDefer: DeferredTool[] = tools.map((tool) => ({
    ...tool,
    defer_loading: !WHATSAPP_CORE_TOOL_NAMES.has(tool.name),
  }));

  return [TOOL_SEARCH_TOOL, ...withDefer] as Anthropic.MessageCreateParams["tools"];
}
