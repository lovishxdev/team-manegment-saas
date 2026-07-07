import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";

/**
 * Generic tool-input salvage for LLM callers.
 *
 * Models invent parameter names ("description" instead of "query", "topic",
 * "text", ...). Schema validation silently strips unknown keys, so the
 * intent is lost and the tool degrades to its no-argument behavior. An
 * alias table can't win that game — the space of wrong names is unbounded.
 *
 * Two tiers, cheapest first:
 *  1. Deterministic: exactly one stray string value + a missing string
 *     parameter → map it (declaration order = intent priority; `workspace`
 *     excluded — it's an optional modifier on every tool, an unnamed
 *     string is almost never meant for it). Zero cost, covers the common
 *     single-typo case.
 *  2. Model repair: anything with stray values the deterministic rule
 *     can't safely place (two strays, wrong types, no obvious slot) goes
 *     to one cheap forced-JSON call that remaps strays onto declared
 *     parameters. Hard rules enforced in code, not trusted to the model:
 *     values provided under correct names are never altered, only declared
 *     keys survive, and any failure/timeout falls back to the original
 *     arguments. Runs only on malformed calls — well-formed traffic never
 *     pays the latency.
 *
 * Pure of registry imports so every channel can use it without cycles.
 */

const EXCLUDED_TARGETS = new Set(["workspace"]);

const REPAIR_MODEL =
  process.env.MEMORY_CAPTURE_MODEL?.trim() || "claude-haiku-4-5";
const REPAIR_TIMEOUT_MS = 6_000;

/** Loose on purpose: zod v4 types raw shapes via its core interface, which
 *  doesn't match ZodTypeAny structurally. Runtime instanceof checks below
 *  are what actually matter. */
type Shape = Readonly<Record<string, unknown>>;

function unwrap(schema: unknown): unknown {
  let current: unknown = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodNullable
  ) {
    current = current._def.innerType;
  }
  return current;
}

function isStringParam(schema: unknown): boolean {
  return unwrap(schema) instanceof z.ZodString;
}

function paramTypeLabel(schema: unknown): string {
  const inner = unwrap(schema);
  if (inner instanceof z.ZodString) return "string";
  if (inner instanceof z.ZodNumber) return "number";
  if (inner instanceof z.ZodBoolean) return "boolean";
  if (inner instanceof z.ZodEnum) {
    try {
      return `enum(${(inner.options as string[]).join("|")})`;
    } catch {
      return "enum";
    }
  }
  if (inner instanceof z.ZodArray) return "array";
  return "value";
}

function paramDescription(schema: unknown): string {
  const desc = (schema as { description?: unknown }).description;
  return typeof desc === "string" ? desc : "";
}

function strayEntries(
  shape: Shape,
  record: Record<string, unknown>
): [string, unknown][] {
  const declared = new Set(Object.keys(shape));
  return Object.entries(record).filter(
    ([key, value]) => !declared.has(key) && value !== undefined
  );
}

/** Tier 1 — deterministic single-stray mapping. Returns the input object
 *  itself (same reference) when it doesn't apply. */
export function salvageArgumentsForShape(
  shape: Shape,
  args: unknown,
  toolName = "tool"
): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;

  const record = args as Record<string, unknown>;
  const declared = Object.keys(shape);

  // Only claim the call when there's exactly one stray overall and it's a
  // string — mixed strays (e.g. a string plus a number) go to the model
  // tier so the whole call is repaired together.
  const strays = strayEntries(shape, record);
  if (strays.length !== 1) return args;
  const [strayKey, strayValue] = strays[0];
  if (typeof strayValue !== "string" || !strayValue.trim()) return args;

  const target = declared.find(
    (key) =>
      !EXCLUDED_TARGETS.has(key) &&
      isStringParam(shape[key]) &&
      (record[key] === undefined || record[key] === null || record[key] === "")
  );
  if (!target) return args;

  const salvaged: Record<string, unknown> = { ...record };
  delete salvaged[strayKey];
  salvaged[target] = strayValue;
  console.log(
    `[tool-salvage] ${toolName}: mapped stray "${strayKey}" -> "${target}"`
  );
  return salvaged;
}

const REPAIR_TOOL: Anthropic.Tool = {
  name: "repair_arguments",
  description:
    "Return the corrected arguments object for the tool call. Always call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      arguments: {
        type: "object",
        description:
          "The corrected arguments, using ONLY declared parameter names. Move each misnamed value to the declared parameter it was clearly intended for; drop a stray entirely if no mapping is clear. Never invent or rewrite values.",
      },
    },
    required: ["arguments"],
  },
};

/** Tier 2 — one cheap model call remaps strays the deterministic rule
 *  couldn't place. Falls back to the original arguments on any failure. */
async function repairArgumentsWithModel(
  shape: Shape,
  record: Record<string, unknown>,
  toolName: string
): Promise<unknown> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return record;

  const declared = Object.keys(shape);
  const paramLines = declared.map((key) => {
    const provided = record[key] !== undefined ? " (already provided)" : "";
    const desc = paramDescription(shape[key]);
    return `- ${key}: ${paramTypeLabel(shape[key])}${provided}${desc ? ` — ${desc}` : ""}`;
  });

  try {
    const anthropic = new Anthropic({
      apiKey,
      timeout: REPAIR_TIMEOUT_MS,
      maxRetries: 0,
    });
    const res = await anthropic.messages.create({
      model: REPAIR_MODEL,
      max_tokens: 500,
      system:
        "You repair the arguments of a tool call made by another AI that used wrong parameter names. " +
        "Map each misnamed argument onto the declared parameter it was clearly intended for. " +
        "Never invent values, never rewrite values, never touch arguments that already use declared names. " +
        "If a stray argument has no clear home, drop it.",
      messages: [
        {
          role: "user",
          content: [
            `Tool: ${toolName}`,
            `Declared parameters:`,
            ...paramLines,
            ``,
            `Arguments actually sent:`,
            JSON.stringify(record),
          ].join("\n"),
        },
      ],
      tools: [REPAIR_TOOL],
      tool_choice: { type: "tool", name: "repair_arguments" },
    });

    const toolUse = res.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    const proposed = (toolUse?.input as { arguments?: unknown })?.arguments;
    if (!proposed || typeof proposed !== "object" || Array.isArray(proposed)) {
      return record;
    }

    // Code-enforced guardrails: only declared keys survive, and values the
    // caller provided under correct names always win over the model's.
    const repaired: Record<string, unknown> = {};
    for (const key of declared) {
      const value = (proposed as Record<string, unknown>)[key];
      if (value !== undefined) repaired[key] = value;
    }
    for (const key of declared) {
      if (record[key] !== undefined) repaired[key] = record[key];
    }

    console.log(
      `[tool-salvage] ${toolName}: model repair ${JSON.stringify(record)} -> ${JSON.stringify(repaired)}`
    );
    return repaired;
  } catch (err) {
    console.error(`[tool-salvage] ${toolName}: model repair failed:`, err);
    return record;
  }
}

/** Full salvage: deterministic tier, then model tier for leftover strays. */
export async function salvageToolArguments(
  shape: Shape,
  args: unknown,
  toolName = "tool"
): Promise<unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;

  const deterministic = salvageArgumentsForShape(shape, args, toolName);
  if (deterministic !== args) return deterministic;

  const record = args as Record<string, unknown>;
  if (strayEntries(shape, record).length === 0) return args;
  return repairArgumentsWithModel(shape, record, toolName);
}

/**
 * Rewrites tools/call messages in a JSON-RPC body (single or batch) with
 * salvaged arguments. Non-JSON and non-tool messages pass through untouched.
 * The shape lookup is injected to avoid a registry import cycle.
 */
export async function salvageJsonRpcBody(
  rawBody: string,
  lookupShape: (toolName: string) => Shape | undefined
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return rawBody;
  }

  const fix = async (message: unknown): Promise<unknown> => {
    if (
      message &&
      typeof message === "object" &&
      (message as { method?: unknown }).method === "tools/call"
    ) {
      const params = (
        message as { params?: { name?: unknown; arguments?: unknown } }
      ).params;
      if (params && typeof params.name === "string") {
        const shape = lookupShape(params.name);
        if (shape) {
          params.arguments = await salvageToolArguments(
            shape,
            params.arguments,
            params.name
          );
        }
      }
    }
    return message;
  };

  const fixed = Array.isArray(parsed)
    ? await Promise.all(parsed.map(fix))
    : await fix(parsed);
  return JSON.stringify(fixed);
}
