import type Anthropic from "@anthropic-ai/sdk";
import type { ActionOutcome } from "@/lib/channel-formatters";

/** Must run before other tools in the same Haiku turn (session workspace). */
const SEQUENTIAL_FIRST = new Set(["create_workspace", "switch_workspace"]);

/** Staging flows that mutate session flags — keep ordered. */
const STAGING_ACTIONS = new Set([
  "delete_task",
  "demote_member",
  "remove_member",
  "delete_asset",
  "show_workspace_picker",
]);

export type ToolRunResult = {
  toolUseId: string;
  action: string;
  result: string;
  outcome: ActionOutcome;
};

/** Client-executable tool_use blocks (skip server-side tool search). */
export function getClientToolUses(
  content: Anthropic.ContentBlock[]
): Anthropic.ToolUseBlock[] {
  return content.filter(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && !block.id.startsWith("srvtoolu_")
  );
}

/**
 * Run a batch of tool calls from one Haiku turn.
 * Workspace + staging tools run sequentially; independent tools run in parallel.
 */
export async function runClientToolUses(
  toolUses: Anthropic.ToolUseBlock[],
  runOne: (toolUse: Anthropic.ToolUseBlock) => Promise<ToolRunResult>
): Promise<ToolRunResult[]> {
  if (toolUses.length === 0) return [];
  if (toolUses.length === 1) return [await runOne(toolUses[0])];

  const prelude = toolUses.filter((t) => SEQUENTIAL_FIRST.has(t.name));
  const rest = toolUses.filter((t) => !SEQUENTIAL_FIRST.has(t.name));
  const staging = rest.filter((t) => STAGING_ACTIONS.has(t.name));
  const parallel = rest.filter((t) => !STAGING_ACTIONS.has(t.name));

  const results: ToolRunResult[] = [];

  for (const toolUse of prelude) {
    results.push(await runOne(toolUse));
  }
  for (const toolUse of staging) {
    results.push(await runOne(toolUse));
  }

  if (parallel.length <= 1) {
    for (const toolUse of parallel) {
      results.push(await runOne(toolUse));
    }
  } else {
    const batch = await Promise.all(parallel.map((toolUse) => runOne(toolUse)));
    results.push(...batch);
  }

  const byId = new Map(results.map((r) => [r.toolUseId, r]));
  return toolUses.map((t) => {
    const hit = byId.get(t.id);
    if (!hit) throw new Error(`Missing tool result for ${t.name} (${t.id})`);
    return hit;
  });
}
