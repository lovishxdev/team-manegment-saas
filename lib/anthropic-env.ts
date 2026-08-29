import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "dotenv";

function normalizeKey(raw: string | undefined | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  return trimmed || undefined;
}

/** Cached .env fallback — only read once per process. */
let cachedFromEnvFile: string | undefined | null = null;

/**
 * When the shell exports ANTHROPIC_API_KEY="" (common in IDE terminals), Next.js
 * and dotenv will not override it from .env. Read .env directly as a fallback.
 */
function readAnthropicKeyFromEnvFile(): string | undefined {
  if (cachedFromEnvFile !== null) {
    return cachedFromEnvFile ?? undefined;
  }
  cachedFromEnvFile = undefined;
  try {
    const envPath = join(process.cwd(), ".env");
    if (!existsSync(envPath)) return undefined;
    const parsed = parse(readFileSync(envPath, "utf8"));
    const key = normalizeKey(parsed.ANTHROPIC_API_KEY);
    cachedFromEnvFile = key ?? undefined;
    return key;
  } catch {
    return undefined;
  }
}

/** Server-side Anthropic API key (WhatsApp, app chat, memory capture). */
export function getAnthropicApiKey(): string | undefined {
  const fromProcess = normalizeKey(process.env.ANTHROPIC_API_KEY);
  if (fromProcess) return fromProcess;
  return readAnthropicKeyFromEnvFile();
}

export function anthropicKeyStatus(): "ok" | "unset" | "empty" {
  if (getAnthropicApiKey()) return "ok";
  if (process.env.ANTHROPIC_API_KEY === undefined) return "unset";
  return "empty";
}

export function anthropicKeySetupHint(): string {
  const status = anthropicKeyStatus();
  if (status === "ok") return "";

  if (status === "unset") {
    return (
      "Add ANTHROPIC_API_KEY to your .env file (same key used for WhatsApp), " +
      "then restart the dev server with npm run dev."
    );
  }

  const fileKey = readAnthropicKeyFromEnvFile();
  if (fileKey) {
    return (
      "ANTHROPIC_API_KEY is set in .env but your shell has an empty " +
      "ANTHROPIC_API_KEY variable that blocks it. Run: unset ANTHROPIC_API_KEY " +
      "then restart npm run dev."
    );
  }

  return (
    "ANTHROPIC_API_KEY is present but empty. Set it in .env " +
    "(see .env.example), save, then restart npm run dev."
  );
}
