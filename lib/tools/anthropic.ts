import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { ToolDef } from "@/lib/tools/types";

/**
 * Generate Anthropic native tool schemas from the registry's Zod shapes.
 * Zod v4 ships a JSON Schema converter, so schemas never drift from dispatch.
 */
export function toAnthropicTool(def: ToolDef): Anthropic.Tool {
  const shape = def.waInputShape ?? def.inputShape;
  const json = z.toJSONSchema(z.object(shape), {
    io: "input",
    target: "draft-7",
  }) as Record<string, unknown>;

  delete json.$schema;
  delete json.additionalProperties;

  return {
    name: def.name,
    description: def.waDescription,
    input_schema: json as Anthropic.Tool.InputSchema,
  };
}

export function toAnthropicTools(defs: ToolDef[]): Anthropic.Tool[] {
  return defs.map(toAnthropicTool);
}
