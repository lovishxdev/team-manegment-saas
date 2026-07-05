import type Anthropic from "@anthropic-ai/sdk";
import type { ActionOutcome } from "@/lib/channel-formatters";
import { classifyActionOutcome } from "@/lib/whatsapp-action-outcome";
import {
  getClientToolUses,
  runClientToolUses,
} from "@/lib/whatsapp-tool-batch";

export type AgentLoopInput = {
  anthropic: Anthropic;
  model: string;
  maxTokens?: number;
  systemPrompt: string;
  tools: Anthropic.Tool[] | Anthropic.ToolUnion[];
  messages: Anthropic.MessageParam[];
  maxTurns: number;
  runTool: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>;
  onProgress?: (action: string, result: string) => void | Promise<void>;
};

export type AgentLoopResult = {
  actionResults: ActionOutcome[];
  reply: string | null;
  assistantNote: string | null;
  budgetExhausted: boolean;
};

export async function runWhatsAppAgentLoop(
  input: AgentLoopInput
): Promise<AgentLoopResult> {
  const actionResults: ActionOutcome[] = [];
  let reply: string | null = null;
  let assistantNote: string | null = null;
  let budgetExhausted = true;
  const messages = [...input.messages];

  // Prompt caching: tool schemas are identical for every user and message
  // (breakpoint on the last tool caches the whole block); the system prompt
  // is stable per user per day. Together they are ~80–90% of input tokens.
  const tools = input.tools.map((tool, i) =>
    i === input.tools.length - 1
      ? { ...tool, cache_control: { type: "ephemeral" as const } }
      : tool
  ) as Anthropic.ToolUnion[];
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: input.systemPrompt,
      cache_control: { type: "ephemeral" },
    },
  ];

  for (let turn = 0; turn < input.maxTurns; turn++) {
    const response = await input.anthropic.messages.create({
      model: input.model,
      max_tokens: input.maxTokens ?? 1024,
      system,
      tools,
      messages,
    });

    const toolUses = getClientToolUses(response.content);

    if (toolUses.length === 0) {
      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      budgetExhausted = false;
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      const note = textBlock?.text.trim() || null;
      if (actionResults.length === 0) {
        reply = note;
      } else if (note) {
        assistantNote = note;
      }
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const batchResults = await runClientToolUses(toolUses, async (toolUse) => {
      const result = await input.runTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>
      );
      const outcome = classifyActionOutcome(toolUse.name, result);
      actionResults.push(outcome);
      await input.onProgress?.(toolUse.name, result);
      return {
        toolUseId: toolUse.id,
        action: toolUse.name,
        result,
        outcome,
      };
    });

    const results: Anthropic.ToolResultBlockParam[] = batchResults.map(
      (row) => ({
        type: "tool_result",
        tool_use_id: row.toolUseId,
        content: row.result,
      })
    );
    messages.push({ role: "user", content: results });
  }

  return { actionResults, reply, assistantNote, budgetExhausted };
}
