import type { ActionOutcome } from "@/lib/channel-formatters";

/**
 * WhatsApp reply assembly. Tool handlers emit final user-facing copy
 * (lib/tools/defs/*) — this module only combines multiple outcomes into one
 * message. No string rewriting: if copy is wrong, fix it at the source.
 */

/** Friendly short date for chat (e.g. "Fri 6 Jun"). */
export function formatChatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatWhatsAppUserReply(
  outcomes: ActionOutcome[],
  budgetExhausted: boolean,
  assistantNote?: string | null
): string {
  const note = assistantNote?.trim();
  const withMessage = outcomes.filter((o) => o.message.trim());
  const successes = withMessage.filter((o) => o.ok);
  const failures = withMessage.filter((o) => !o.ok);

  const successMessages = successes.map((o) => o.message.trim());
  const failureMessages = [...new Set(failures.map((o) => o.message.trim()))];

  if (successes.length === 1 && failures.length === 0 && !budgetExhausted) {
    return successMessages[0];
  }

  if (withMessage.length === 0 && note) return note;

  if (withMessage.length === 0) {
    return "Tell me what to add or change on your board — or send *menu*.";
  }

  if (failures.length === 0 && !budgetExhausted && successes.length > 1) {
    return successMessages.map((msg) => `• ${msg}`).join("\n");
  }

  if (failures.length > 0 && successes.length === 0) {
    let body = failureMessages.join("\n");
    if (budgetExhausted) {
      body += "\n\nI ran out of steps — send the rest in a new message.";
    }
    return body;
  }

  if (failures.length > 0 && successes.length > 0) {
    const lines = [
      ...successMessages.map((msg) => `✓ ${msg}`),
      ...failureMessages.map((msg) => `✗ ${msg}`),
    ];
    return `${lines.join("\n")}\n\nFix the ✗ lines and try again.`;
  }

  if (budgetExhausted && successes.length > 0 && failures.length === 0) {
    return `${successMessages.map((m) => `• ${m}`).join("\n")}\n\nSend any remaining steps in a new message.`;
  }

  return successMessages.join("\n");
}
