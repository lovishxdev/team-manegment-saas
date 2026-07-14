import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import {
  normalizeMemoryTags,
} from "@/lib/services/memory";
import {
  parseMemoryDocument,
  type MemoryDocumentInput,
} from "@/lib/memory/documents";
import { recordMemoryModelUsage } from "@/lib/memory/model-usage";

/**
 * Admission gate for Markdown snapshots. File names are weak signals: a
 * README may contain critical architecture, while an ADR may be boilerplate.
 * This selector judges content before anything is persisted.
 */

const DOCUMENT_MODEL =
  process.env.MEMORY_DOCUMENT_MODEL?.trim() ||
  process.env.MEMORY_CAPTURE_MODEL?.trim() ||
  "claude-haiku-4-5";

export type MemoryDocumentDecision = {
  path: string;
  keep: boolean;
  reason: string;
  title?: string;
  tags?: string[];
  explicit: boolean;
};

type ToolOutput = {
  decisions?: {
    path?: string;
    keep?: boolean;
    reason?: string;
    title?: string;
    tags?: string[];
  }[];
};

const SELECT_TOOL: Anthropic.Tool = {
  name: "select_memory_documents",
  description:
    "Decide which Markdown documents provide durable project memory. Return one decision for every supplied path.",
  input_schema: {
    type: "object",
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            keep: { type: "boolean" },
            reason: {
              type: "string",
              description: "One sentence explaining why this is or is not durable project context.",
            },
            title: {
              type: "string",
              description: "Concise human-facing title when kept.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              maxItems: 4,
              description: "1-4 stable topic tags when kept.",
            },
          },
          required: ["path", "keep", "reason"],
        },
      },
    },
    required: ["decisions"],
  },
};

const SYSTEM = `You are the admission gate for a team's persistent project-memory document library.

KEEP documents whose content preserves durable context someone will need later:
- architecture rationale, ADRs, contracts, boundaries, conventions;
- product policy, positioning, pricing/billing rules, durable team agreements;
- operational constraints, incident lessons, integration behavior, handoff context;
- non-obvious "why" that code alone cannot answer.

DROP documents that are primarily:
- generic installation/setup instructions or environment-variable checklists;
- README feature overviews recoverable by browsing the repository;
- changelogs, shipped-work inventories, temporary plans, generated reports;
- API/reference documentation that states mechanics without rationale;
- marketing/demo copy without a binding product-positioning decision.

Judge the content, never the filename alone. Keep only documents whose omission would make a future teammate or agent materially less informed. Be conservative: storage is not the same as memory.`;

function explicitPreference(content: string): boolean | null {
  const frontmatter =
    content.startsWith("---\n") && content.indexOf("\n---", 4) >= 0
      ? content.slice(4, content.indexOf("\n---", 4))
      : "";
  if (/^euclis-memory:\s*true\s*$/im.test(frontmatter)) return true;
  if (/^euclis-memory:\s*false\s*$/im.test(frontmatter)) return false;
  return null;
}

export async function selectMemoryDocuments(
  documents: MemoryDocumentInput[],
  context?: { workspaceId?: string; userId?: string; conversationId?: string }
): Promise<MemoryDocumentDecision[]> {
  if (documents.length === 0) return [];

  const explicit: MemoryDocumentDecision[] = [];
  const undecided: MemoryDocumentInput[] = [];
  for (const document of documents) {
    const preference = explicitPreference(document.content);
    const parsed = parseMemoryDocument(document.content);
    if (preference !== null) {
      explicit.push({
        path: document.path,
        keep: preference,
        reason: preference
          ? "Explicitly included by euclis-memory: true."
          : "Explicitly excluded by euclis-memory: false.",
        title: parsed?.title,
        tags: parsed?.tags,
        explicit: true,
      });
    } else {
      undecided.push(document);
    }
  }

  if (undecided.length === 0) return explicit;
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return [
      ...explicit,
      ...undecided.map((document) => ({
        path: document.path,
        keep: false,
        reason: "No document-selection model is configured.",
        explicit: false,
      })),
    ];
  }

  const anthropic = new Anthropic({ apiKey });
  const startedAt = Date.now();
  const response = await anthropic.messages.create({
    model: DOCUMENT_MODEL,
    max_tokens: 1800,
    temperature: 0,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: undecided
          .map(
            (document) =>
              `--- ${document.path} ---\n${document.content}`
          )
          .join("\n\n"),
      },
    ],
    tools: [SELECT_TOOL],
    tool_choice: { type: "tool", name: "select_memory_documents" },
  });
  await recordMemoryModelUsage({
    workspaceId: context?.workspaceId,
    userId: context?.userId,
    stage: "document-selector",
    model: DOCUMENT_MODEL,
    response,
    durationMs: Date.now() - startedAt,
    conversationId: context?.conversationId,
  }).catch((error) =>
    console.error("[document-selector] usage record failed:", error)
  );
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  const output = toolUse?.input as ToolOutput | undefined;
  const byPath = new Map(
    (output?.decisions ?? []).map((decision) => [decision.path, decision])
  );

  return [
    ...explicit,
    ...undecided.map((document): MemoryDocumentDecision => {
      const decision = byPath.get(document.path);
      const keep =
        typeof decision?.keep === "boolean" ? decision.keep : false;
      return {
        path: document.path,
        keep,
        reason:
          decision?.reason?.trim() ||
          "The selector returned no valid decision; rejected safely.",
        title: keep ? decision?.title?.trim().slice(0, 200) : undefined,
        tags: keep ? normalizeMemoryTags(decision?.tags) : undefined,
        explicit: false,
      };
    }),
  ];
}
