import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import type { MemoryEventRow } from "@/lib/services/memory";

/**
 * Final precision pass for get_project_context.
 *
 * Embeddings are good at finding topically adjacent records, but "adjacent"
 * is not the same as "this changes the work I'm about to do". This selector
 * sees only the small candidate set returned by hybrid recall and chooses the
 * records that are operationally relevant. It never creates, resolves, or
 * rewrites memory.
 */

const CONTEXT_MODEL =
  process.env.MEMORY_CONTEXT_MODEL?.trim() ||
  process.env.MEMORY_CAPTURE_MODEL?.trim() ||
  "claude-haiku-4-5";

const MAX_SELECTED = 4;

type Selection = {
  selected_ids?: string[];
  stale_open_ids?: string[];
};

export type ContextSelection = {
  selected: MemoryEventRow[];
  /** Open rows whose own text says the underlying issue was fixed/verified. */
  staleOpen: MemoryEventRow[];
};

const SELECT_TOOL: Anthropic.Tool = {
  name: "select_project_context",
  description:
    "Select only memory records that directly affect the requested work. Always call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      selected_ids: {
        type: "array",
        items: { type: "string" },
        maxItems: MAX_SELECTED,
        description:
          "Candidate ids that directly constrain, explain, or block the requested work. Topical adjacency alone is not enough.",
      },
      stale_open_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "OPEN blocker/dependency ids whose own summary/reasoning says the issue was fixed, verified, deployed, or now works. These need human resolution review and must not be presented as active blockers.",
      },
    },
    required: ["selected_ids", "stale_open_ids"],
  },
};

const SYSTEM = `You select compact project context for a coding agent.

The query describes the work the agent is about to do. Choose a memory record only when knowing it would change implementation, prevent a mistake, explain a binding choice, or identify a blocker that directly affects that work.

Match the requested work domain, not just the same feature name. For example:
- copy/SEO/content work needs only messaging, claims, feature availability,
  terminology, and audience positioning. It does not need visual styling,
  animation, scroll behavior, spacing, component-layout, or implementation
  decisions even when they describe the same landing page;
- backend work does not need unrelated landing-page presentation decisions;
- a broad feature mention inside both texts does not make them relevant.

Reject:
- merely topically adjacent records;
- general product history and completed implementation details;
- blockers from unrelated features;
- an OPEN row whose own wording says the issue was fixed, verified, deployed, or works in a fresh process. Put those ids in stale_open_ids instead — never selected_ids.

Return the smallest sufficient set (normally 1-3 records, hard maximum 4).
Precision is more important than recall. Returning no records is correct when nothing directly applies. Never invent ids.`;

function formatCandidate(event: MemoryEventRow): string {
  const why = event.reasoning ? `\n  why: ${event.reasoning}` : "";
  const task = event.task
    ? ` · task #${event.task.shortId} "${event.task.title}"`
    : "";
  const tags = event.tags.length > 0 ? ` · tags=${event.tags.join(",")}` : "";
  return `- id=${event.id} [${event.kind} · ${event.status}${task}${tags}] ${event.summary}${why}`;
}

export async function selectRelevantProjectContext(input: {
  query: string;
  candidates: MemoryEventRow[];
}): Promise<ContextSelection> {
  if (input.candidates.length === 0) {
    return { selected: [], staleOpen: [] };
  }

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      selected: input.candidates.slice(0, MAX_SELECTED),
      staleOpen: [],
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: CONTEXT_MODEL,
      max_tokens: 500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `Work request: ${input.query}`,
            "",
            "Hybrid-recall candidates:",
            input.candidates.map(formatCandidate).join("\n"),
          ].join("\n"),
        },
      ],
      tools: [SELECT_TOOL],
      tool_choice: { type: "tool", name: "select_project_context" },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) {
      return {
        selected: input.candidates.slice(0, MAX_SELECTED),
        staleOpen: [],
      };
    }

    const selection = toolUse.input as Selection;
    const byId = new Map(input.candidates.map((event) => [event.id, event]));
    const staleIds = new Set(
      (selection.stale_open_ids ?? []).filter((id) => {
        const event = byId.get(id);
        return (
          event?.status === "OPEN" &&
          (event.kind === "BLOCKER" || event.kind === "DEPENDENCY")
        );
      })
    );
    const selected = (selection.selected_ids ?? [])
      .map((id) => byId.get(id))
      .filter((event): event is MemoryEventRow => Boolean(event))
      .filter((event) => !staleIds.has(event.id))
      .slice(0, MAX_SELECTED);

    return {
      selected,
      staleOpen: [...staleIds]
        .map((id) => byId.get(id))
        .filter((event): event is MemoryEventRow => Boolean(event)),
    };
  } catch (error) {
    console.error("[memory-context] selector failed, using recall order:", error);
    return {
      selected: input.candidates.slice(0, MAX_SELECTED),
      staleOpen: [],
    };
  }
}
