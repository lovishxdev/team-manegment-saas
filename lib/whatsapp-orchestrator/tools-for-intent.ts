import type Anthropic from "@anthropic-ai/sdk";
import type { WhatsAppIntent } from "@/lib/whatsapp-orchestrator/types";

const INTENT_TOOLS: Partial<Record<WhatsAppIntent, string[]>> = {
  board_list: ["get_board_state", "list_my_tasks"],
  create_task: ["create_task", "list_categories"],
  update_task: ["update_task", "find_task", "get_board_state"],
  post_update: ["add_task_update", "find_task", "ask_task"],
  ask_task: ["ask_task", "find_task", "list_task_updates"],
  read_task: ["read_task", "find_task", "list_task_updates"],
  delete_task: ["delete_task", "find_task"],
  search_tasks: ["search_tasks", "find_task", "get_board_state"],
  menu: [],
  chitchat: [],
  greeting: [],
};

/** Narrow tool set for simple-path Haiku — full list for complex/unknown. */
export function toolsForIntent(
  allTools: Anthropic.Tool[],
  intent: WhatsAppIntent,
  complex: boolean
): Anthropic.Tool[] {
  if (complex || intent === "compound" || intent === "unknown") {
    return allTools;
  }

  const names = INTENT_TOOLS[intent];
  if (!names || names.length === 0) return allTools;

  const allowed = new Set(names);
  const filtered = allTools.filter((t) => allowed.has(t.name));
  return filtered.length > 0 ? filtered : allTools;
}

export function triageSystemAugment(triage: {
  intent: WhatsAppIntent;
  complexity: string;
  slots?: Record<string, unknown>;
}): string {
  return (
    `\n\n[Orchestrator triage]\n` +
    `Intent: ${triage.intent} (${triage.complexity})\n` +
    `Slots: ${JSON.stringify(triage.slots ?? {})}\n` +
    `Execute this intent with tools. Leave final assistant text EMPTY when tool output is user-ready.`
  );
}
