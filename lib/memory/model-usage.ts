import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

export type MemoryModelStage =
  | "agent-extractor"
  | "candidate-critic"
  | "thread-extractor"
  | "context-selector"
  | "document-selector"
  | "dream-proposer"
  | "dream-adversary"
  | "dream-judge";

type UsageResponse = Pick<Anthropic.Message, "usage">;

export async function recordAIUsageRaw(input: {
  workspaceId?: string;
  userId?: string;
  feature: string;
  operation: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  estimatedCostUsd?: number;
  durationMs: number;
  conversationId?: string;
  runId?: string;
  estimatedTokensSaved?: number;
  status?: "SUCCESS" | "ERROR";
  errorCode?: string;
}): Promise<void> {
  await prisma.aIUsageRecord.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      feature: input.feature,
      operation: input.operation,
      provider: input.provider,
      model: input.model,
      inputTokens: Math.max(0, Math.round(input.inputTokens)),
      outputTokens: Math.max(0, Math.round(input.outputTokens ?? 0)),
      cacheReadTokens: Math.max(0, Math.round(input.cacheReadTokens ?? 0)),
      cacheCreationTokens: Math.max(
        0,
        Math.round(input.cacheCreationTokens ?? 0)
      ),
      estimatedCostUsd: Math.max(0, input.estimatedCostUsd ?? 0),
      durationMs: Math.max(0, Math.round(input.durationMs)),
      conversationId: input.conversationId ?? null,
      runId: input.runId ?? null,
      estimatedTokensSaved: Math.max(
        0,
        Math.round(input.estimatedTokensSaved ?? 0)
      ),
      status: input.status ?? "SUCCESS",
      errorCode: input.errorCode ?? null,
    },
  });
}

function ratesPerMillion(model: string): {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
} {
  const name = model.toLowerCase();
  if (name.includes("haiku")) {
    return { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 };
  }
  if (name.includes("opus")) {
    return { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 };
  }
  // Sonnet default.
  return { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 };
}

export async function recordAnthropicAIUsage(input: {
  workspaceId?: string;
  userId?: string;
  feature: string;
  operation: string;
  model: string;
  response: UsageResponse;
  durationMs: number;
  conversationId?: string;
  runId?: string;
  estimatedTokensSaved?: number;
  status?: "SUCCESS" | "ERROR";
  errorCode?: string;
}): Promise<void> {
  const usage = input.response.usage as Anthropic.Message["usage"] & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
  const rates = ratesPerMillion(input.model);
  const estimatedCostUsd =
    (inputTokens * rates.input +
      outputTokens * rates.output +
      cacheReadTokens * rates.cacheRead +
      cacheCreationTokens * rates.cacheCreation) /
    1_000_000;

  await recordAIUsageRaw({
    ...input,
    provider: "anthropic",
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    estimatedCostUsd,
  });
}

export async function recordMemoryModelUsage(input: {
  workspaceId?: string;
  userId?: string;
  stage: MemoryModelStage;
  model: string;
  response: UsageResponse;
  durationMs: number;
  conversationId?: string;
  runId?: string;
  estimatedTokensSaved?: number;
}): Promise<void> {
  return recordAnthropicAIUsage({
    ...input,
    feature: "memory",
    operation: input.stage,
  });
}
