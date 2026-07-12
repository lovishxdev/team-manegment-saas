import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-env";
import type {
  MemoryCandidateAuthority,
  MemoryCandidateScope,
  MemoryEventKind,
} from "@/lib/generated/prisma/client";
import type { AgentSessionDocument } from "@/lib/memory/agent-capture";

const CRITIC_MODEL =
  process.env.MEMORY_CRITIC_MODEL?.trim() || "claude-sonnet-4-5";

export type ExtractedCandidate = {
  kind: MemoryEventKind;
  summary: string;
  reasoning?: string;
  tags?: string[];
  taskShortId?: number;
  sourceDocumentPath?: string;
  evidenceQuote: string;
  supersedesEventId?: string;
};

export type CandidateCritique = ExtractedCandidate & {
  scope: MemoryCandidateScope;
  authority: MemoryCandidateAuthority;
  durabilityScore: number;
  coordinationScore: number;
  codeRecoverable: boolean;
  localReversible: boolean;
  recommendation: "PROMOTE" | "PENDING" | "REJECT";
  criticReason: string;
};

type CriticOutput = {
  reviews?: {
    index?: number;
    scope?: MemoryCandidateScope;
    durability_score?: number;
    coordination_score?: number;
    code_recoverable?: boolean;
    local_reversible?: boolean;
    recommendation?: "PROMOTE" | "PENDING" | "REJECT";
    reason?: string;
  }[];
};

const CRITIC_TOOL: Anthropic.Tool = {
  name: "criticize_memory_candidates",
  description:
    "Independently assess each extracted memory candidate. Return one review per index.",
  input_schema: {
    type: "object",
    properties: {
      reviews: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "number" },
            scope: {
              type: "string",
              enum: ["SESSION", "TASK", "PROJECT"],
            },
            durability_score: {
              type: "number",
              description: "0-100: likelihood this matters at least one month later.",
            },
            coordination_score: {
              type: "number",
              description: "0-100: how much another teammate needs this to avoid a mistake/conflict.",
            },
            code_recoverable: {
              type: "boolean",
              description: "True when code/git/file contents already answer the fact.",
            },
            local_reversible: {
              type: "boolean",
              description: "True for a local choice easily changed without coordinating with others.",
            },
            recommendation: {
              type: "string",
              enum: ["PROMOTE", "PENDING", "REJECT"],
            },
            reason: {
              type: "string",
              description: "Concise evidence-based quality judgment.",
            },
          },
          required: [
            "index",
            "scope",
            "durability_score",
            "coordination_score",
            "code_recoverable",
            "local_reversible",
            "recommendation",
            "reason",
          ],
        },
      },
    },
    required: ["reviews"],
  },
};

const SYSTEM = `You are an independent quality critic for persistent team memory. The extractor is noisy and frequently mistakes implementation narration for decisions. Your job is to reject that noise.

Scope:
- SESSION: useful only while performing this run.
- TASK: useful for this deliverable, but does not bind the broader project.
- PROJECT: durable contract, architecture boundary, policy, external constraint, team convention, or rationale that future work must honor.

Reject or mark SESSION/TASK:
- file edits, element positioning, timing, styling, scene composition;
- asset/library/source choices local to one deliverable;
- refactors, bug fixes, test results, shipped-work summaries;
- component reuse or implementation structure visible in code;
- choices easily reversed without teammate coordination.

PROJECT requires non-obvious "why", broad future consequences, and evidence that it was actually settled. A sentence containing "because" is not automatically durable.

recommendation is quality-only. PROMOTE means strong project memory; PENDING means potentially durable but authority/confirmation is uncertain; REJECT means worklog/noise.`;

function clampScore(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value!)));
}

function normalizeForEvidence(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function determineAuthority(input: {
  candidate: ExtractedCandidate;
  transcript: string;
  documents: AgentSessionDocument[];
}): MemoryCandidateAuthority {
  const quote = normalizeForEvidence(input.candidate.evidenceQuote);
  const sourceDocument = input.candidate.sourceDocumentPath
    ? input.documents.find(
        (document) => document.path === input.candidate.sourceDocumentPath
      )
    : undefined;
  if (
    sourceDocument &&
    /^---\n[\s\S]*?^euclis-memory:\s*true\s*$/im.test(sourceDocument.content)
  ) {
    return "DOCUMENT_EXPLICIT";
  }

  const userText = input.transcript
    .split(/\n(?=(?:User|Agent): )/)
    .filter((part) => part.startsWith("User: "))
    .join("\n");
  if (quote.length >= 12 && normalizeForEvidence(userText).includes(quote)) {
    return "HUMAN_EXPLICIT";
  }
  return "AGENT_INFERRED";
}

export async function critiqueCandidates(input: {
  candidates: ExtractedCandidate[];
  transcript: string;
  documents: AgentSessionDocument[];
}): Promise<CandidateCritique[]> {
  if (input.candidates.length === 0) return [];
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return input.candidates.map((candidate) => ({
      ...candidate,
      scope: "SESSION",
      authority: determineAuthority({
        candidate,
        transcript: input.transcript,
        documents: input.documents,
      }),
      durabilityScore: 0,
      coordinationScore: 0,
      codeRecoverable: true,
      localReversible: true,
      recommendation: "REJECT",
      criticReason: "No independent critic model is configured.",
    }));
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: CRITIC_MODEL,
    max_tokens: 1400,
    temperature: 0,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: input.candidates
          .map(
            (candidate, index) =>
              `[${index}] ${candidate.kind}: ${candidate.summary}\nReasoning: ${candidate.reasoning ?? "(none)"}\nEvidence: "${candidate.evidenceQuote}"\nTask: ${candidate.taskShortId ?? "workspace"}\nDocument: ${candidate.sourceDocumentPath ?? "(none)"}`
          )
          .join("\n\n"),
      },
    ],
    tools: [CRITIC_TOOL],
    tool_choice: { type: "tool", name: "criticize_memory_candidates" },
  });
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  const output = toolUse?.input as CriticOutput | undefined;
  const byIndex = new Map(
    (output?.reviews ?? []).map((review) => [review.index, review])
  );

  return input.candidates.map((candidate, index) => {
    const review = byIndex.get(index);
    const authority = determineAuthority({
      candidate,
      transcript: input.transcript,
      documents: input.documents,
    });
    return {
      ...candidate,
      scope:
        review?.scope === "PROJECT" || review?.scope === "TASK"
          ? review.scope
          : "SESSION",
      authority,
      durabilityScore: clampScore(review?.durability_score),
      coordinationScore: clampScore(review?.coordination_score),
      codeRecoverable: review?.code_recoverable !== false,
      localReversible: review?.local_reversible !== false,
      recommendation:
        review?.recommendation === "PROMOTE" ||
        review?.recommendation === "PENDING"
          ? review.recommendation
          : "REJECT",
      criticReason:
        review?.reason?.trim() || "Critic returned no valid assessment.",
    };
  });
}
