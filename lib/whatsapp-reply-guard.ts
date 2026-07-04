import type { ActionOutcome } from "@/lib/channel-formatters";

/**
 * Deterministic output guard — the only check between the agent and the user.
 * No LLM: every rule here is cheap, predictable, and testable. This replaces
 * the old LLM judge layer.
 */

/** WhatsApp rejects messages over 4096 chars; leave headroom. */
const MAX_REPLY_CHARS = 3900;

/** Raw ask_task RAG pack (metadata + full update thread) — never send as-is. */
export function looksLikeFullPack(text: string): boolean {
  return /Updates \(\d+\):/i.test(text) && (text.match(/•/g)?.length ?? 0) >= 3;
}

/** Compress a leaked context pack to the task title + last few updates. */
export function shortenFullPack(rawPack: string): string {
  const titleMatch = rawPack.match(/^\*([^*\n]+)\*/m);
  const title = titleMatch?.[1]?.trim() ?? "That task";

  const bodies = [
    ...rawPack.matchAll(
      /•\s+[\d-]+[\d: ]*·\s+@\S+\s*\n\s+(.+?)(?=\n\n•|\n*$)/gs
    ),
  ]
    .map((m) => m[1].trim())
    .filter(Boolean);

  const recent = bodies.slice(-4);
  if (recent.length === 0) {
    return `*${title}* — I pulled the thread but couldn't compress it. Ask something specific (budget, blockers, latest update).`;
  }

  return `*${title}* — here's the latest:\n${recent.map((b) => `• ${b}`).join("\n")}`;
}

const CAPABILITY_REFUSAL =
  /can'?t post|don'?t have a way|use the web app|unable to (?:post|add|update)/i;

export type GuardInput = {
  /** The reply about to be sent (model-composed or tool-assembled). */
  draft: string;
  /** Deterministic tool-output assembly to fall back to. */
  toolFallback: string;
  actionResults: ActionOutcome[];
};

export function guardWhatsAppReply(input: GuardInput): string {
  let reply = input.draft.trim() || input.toolFallback;

  // Models sometimes emit **markdown** — WhatsApp bold is *single asterisks*.
  reply = reply.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");

  // The model claims it can't do something a tool in this turn just did.
  const succeeded = input.actionResults.some((o) => o.ok && o.message.trim());
  if (succeeded && CAPABILITY_REFUSAL.test(reply)) {
    reply = input.toolFallback;
  }

  // Internal #N ids never reach the user — task titles only.
  reply = reply
    .replace(/\s*\(#\d+\)/g, "")
    .replace(/(^|\s)#\d+\b/g, "$1")
    .replace(/ {2,}/g, " ");

  if (looksLikeFullPack(reply)) {
    reply = shortenFullPack(reply);
  }

  if (reply.length > MAX_REPLY_CHARS) {
    reply = reply.slice(0, MAX_REPLY_CHARS).trimEnd() + " …";
  }

  return reply.trim();
}
