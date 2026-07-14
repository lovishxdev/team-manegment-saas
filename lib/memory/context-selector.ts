import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import type { MemoryEventRow } from "@/lib/services/memory";
import { recordMemoryModelUsage } from "@/lib/memory/model-usage";

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
  selected?: {
    id?: string;
    relevance?: number;
    reason?: string;
    context?: string;
  }[];
  stale_open_ids?: string[];
};

export type ContextSelection = {
  selected: { event: MemoryEventRow; context: string }[];
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
      selected: {
        type: "array",
        maxItems: MAX_SELECTED,
        description:
          "Only candidates that directly constrain, explain, or block the requested work. Topical adjacency alone is not enough.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            relevance: {
              type: "number",
              description:
                "0-100 direct relevance to the concrete work request. Use 70+ only when omitting this record could change the implementation or cause a mistake.",
            },
            reason: {
              type: "string",
              description:
                "One short sentence explaining exactly how this record changes the requested work.",
            },
            context: {
              type: "string",
              description:
                "One concise, source-grounded sentence containing only the part of this record the agent needs. Remove unrelated implementation and presentation detail.",
            },
          },
          required: ["id", "relevance", "reason", "context"],
        },
      },
      stale_open_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "OPEN blocker/dependency ids whose own summary/reasoning says the issue was fixed, verified, deployed, or now works. These need human resolution review and must not be presented as active blockers.",
      },
    },
    required: ["selected", "stale_open_ids"],
  },
};

const SYSTEM = `You select compact project context for a coding agent.

The query describes the work the agent is about to do. Choose a memory record only when knowing it would change implementation, prevent a mistake, explain a binding choice, or identify a blocker that directly affects that work.

Match the concrete objective and operation, not just shared nouns, feature
names, tags, or product area. For every selected record, state exactly how it
changes the requested work. If that reason is merely "both mention X", reject
the record.

Reject:
- merely topically adjacent records;
- general product history and completed implementation details;
- blockers from unrelated features;
- an OPEN row whose own wording says the issue was fixed, verified, deployed, or works in a fresh process. Put those ids in stale_open_ids instead — never selected_ids.

Assign relevance honestly: 70+ means omitting the record could change the
implementation or cause a mistake. Return the smallest sufficient set
(normally 1-3 records, hard maximum 4).

For each selected record, write a compact context sentence containing only
the source-grounded fact needed for this request. A record may contain both
relevant and irrelevant details; never copy the irrelevant parts into
context.
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
  workspaceId?: string;
  userId?: string;
  query: string;
  candidates: MemoryEventRow[];
}): Promise<ContextSelection> {
  if (input.candidates.length === 0) {
    return { selected: [], staleOpen: [] };
  }

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      selected: input.candidates
        .slice(0, MAX_SELECTED)
        .map((event) => ({ event, context: event.summary })),
      staleOpen: [],
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const startedAt = Date.now();
    const response = await anthropic.messages.create({
      model: CONTEXT_MODEL,
      max_tokens: 1200,
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
      await recordMemoryModelUsage({
        workspaceId: input.workspaceId,
        userId: input.userId,
        stage: "context-selector",
        model: CONTEXT_MODEL,
        response,
        durationMs: Date.now() - startedAt,
      }).catch((error) =>
        console.error("[memory-context] usage record failed:", error)
      );
      return {
        selected: input.candidates
          .slice(0, MAX_SELECTED)
          .map((event) => ({ event, context: event.summary })),
        staleOpen: [],
      };
    }

    const selection = toolUse.input as Selection;
    if (process.env.MEMORY_CONTEXT_DEBUG === "1") {
      console.log("[memory-context] raw selection:", selection);
    }
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
    const selected = (selection.selected ?? [])
      .filter(
        (item) =>
          typeof item.id === "string" &&
          typeof item.relevance === "number" &&
          item.relevance >= 70 &&
          typeof item.reason === "string" &&
          item.reason.trim().length >= 8 &&
          typeof item.context === "string" &&
          item.context.trim().length >= 8
      )
      .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
      .map((item) => ({
        event: byId.get(item.id!),
        context: item.context!.trim().slice(0, 500),
      }))
      .filter(
        (
          item
        ): item is { event: MemoryEventRow; context: string } =>
          Boolean(item.event)
      )
      .filter((item) => !staleIds.has(item.event.id))
      .slice(0, MAX_SELECTED);
    const candidateTokens = Math.ceil(
      input.candidates.reduce(
        (sum, event) =>
          sum +
          event.summary.length +
          (event.reasoning?.length ?? 0) +
          event.tags.join(" ").length,
        0
      ) / 4
    );
    const deliveredTokens = Math.ceil(
      selected.reduce((sum, item) => sum + item.context.length, 0) / 4
    );
    await recordMemoryModelUsage({
      workspaceId: input.workspaceId,
      userId: input.userId,
      stage: "context-selector",
      model: CONTEXT_MODEL,
      response,
      durationMs: Date.now() - startedAt,
      estimatedTokensSaved: Math.max(0, candidateTokens - deliveredTokens),
    }).catch((error) =>
      console.error("[memory-context] usage record failed:", error)
    );

    return {
      selected,
      staleOpen: [...staleIds]
        .map((id) => byId.get(id))
        .filter((event): event is MemoryEventRow => Boolean(event)),
    };
  } catch (error) {
    console.error("[memory-context] selector failed, using recall order:", error);
    return {
      selected: input.candidates
        .slice(0, MAX_SELECTED)
        .map((event) => ({ event, context: event.summary })),
      staleOpen: [],
    };
  }
}
