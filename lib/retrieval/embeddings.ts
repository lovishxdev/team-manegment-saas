import { createHash } from "crypto";
import { recordAIUsageRaw } from "@/lib/memory/model-usage";

/** Default when using OpenRouter (provider-prefixed slug). */
export const OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
/** Default when calling OpenAI directly. */
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingProvider = "openrouter" | "openai";

export function resolveEmbeddingProvider(): EmbeddingProvider | null {
  if (process.env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export function embeddingsEnabled(): boolean {
  return resolveEmbeddingProvider() !== null;
}

function embeddingConfig(): {
  provider: EmbeddingProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      provider: "openrouter",
      apiKey: openRouterKey,
      baseUrl: "https://openrouter.ai/api/v1",
      model:
        process.env.EMBEDDING_MODEL?.trim() || OPENROUTER_EMBEDDING_MODEL,
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.EMBEDDING_MODEL?.trim() || OPENAI_EMBEDDING_MODEL,
    };
  }

  throw new Error(
    "No embedding API key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY."
  );
}

/** Embed one or more text chunks. Returns vectors in input order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { apiKey, baseUrl, model, provider } = embeddingConfig();

  const cleaned = texts.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return [];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://euclis.dev";
    headers["X-Title"] = "Euclis";
  }

  const startedAt = Date.now();
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      input: cleaned,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Embedding API failed (${res.status}): ${detail.slice(0, 300)}`
    );
  }

  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
    usage?: {
      prompt_tokens?: number;
      total_tokens?: number;
    };
  };
  const inputTokens =
    json.usage?.prompt_tokens ?? json.usage?.total_tokens ?? 0;
  await recordAIUsageRaw({
    feature: "embeddings",
    operation: "embed-text",
    provider,
    model,
    inputTokens,
    estimatedCostUsd: (inputTokens * 0.02) / 1_000_000,
    durationMs: Date.now() - startedAt,
  }).catch((error) =>
    console.error("[embeddings] usage record failed:", error)
  );

  const ordered = [...json.data].sort((a, b) => a.index - b.index);
  return ordered.map((row) => row.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  if (!vector) throw new Error("Empty embedding response");
  return vector;
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Map cosine [-1,1] to a 0–1 relevance score. */
export function semanticScore(cosine: number): number {
  return (cosine + 1) / 2;
}

export function parseEmbeddingJson(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return null;
  if (!value.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  return value as number[];
}
