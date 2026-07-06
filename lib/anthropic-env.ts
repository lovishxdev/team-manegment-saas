/** Server-side Anthropic API key from environment (WhatsApp, app chat, memory). */
export function getAnthropicApiKey(): string | undefined {
  const raw = process.env.ANTHROPIC_API_KEY;
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  return trimmed || undefined;
}

export function anthropicKeyStatus():
  | "ok"
  | "unset"
  | "empty" {
  if (process.env.ANTHROPIC_API_KEY === undefined) return "unset";
  if (!getAnthropicApiKey()) return "empty";
  return "ok";
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

  return (
    "ANTHROPIC_API_KEY is present in .env but empty. Set it to your real key " +
    '(e.g. ANTHROPIC_API_KEY=sk-ant-api03-...), save the file, then restart npm run dev.'
  );
}
