import type { ConversationTurn } from "@/lib/services/conversation";

/**
 * Deterministic helpers for task identity + user-facing pick prompts.
 *
 * Natural-language understanding (is this a progress report? what should the
 * update say?) belongs to the agent model, which sees the full conversation.
 * Code here only extracts explicit structure (#N ids, bold titles) and
 * formats questions back to the user.
 */

/** Last #N mentioned in recent chat (assistant or user), newest first. */
export function lastTaskShortIdFromTurns(
  turns: ConversationTurn[]
): number | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const matches = [...turns[i].content.matchAll(/#(\d+)\b/g)];
    for (let j = matches.length - 1; j >= 0; j--) {
      const n = Number(matches[j][1]);
      if (Number.isInteger(n) && n > 0) return n;
    }
  }
  return null;
}

/** Task titles from recent assistant replies (bold or after #N). */
export function taskTitleHintsFromTurns(turns: ConversationTurn[]): string[] {
  const hints: string[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const content = turns[i].content;
    const thats = content.match(
      /that['']?s\s+#\d+\s+([^.\n]+?)(?:\.|,|\n|$)/i
    );
    if (thats?.[1]) {
      hints.push(thats[1].replace(/\*+/g, "").trim());
    }
    const afterNum = content.match(/#\d+\s+([^(•\n]+?)(?:\s*\(|\.|,|\n|$)/);
    if (afterNum?.[1]) {
      hints.push(afterNum[1].replace(/\*+/g, "").trim());
    }
    for (const m of content.matchAll(/\*([^*\n]{2,80})\*/g)) {
      const t = m[1].trim();
      if (!/^(to do|in progress|done|high)$/i.test(t)) hints.push(t);
    }
  }
  return [...new Set(hints.filter(Boolean))];
}

/** User-facing prompt when we need them to pick a task — names only, no #N jargon. */
export function formatTaskPickPrompt(
  tasks: { title: string }[],
  prefix = "Which task?"
): string {
  if (tasks.length === 0) {
    return "You don't have any tasks on the board yet.";
  }
  if (tasks.length === 1) {
    return `Did you mean *${tasks[0].title}*?`;
  }
  const lines = tasks.slice(0, 5).map((t) => `• *${t.title}*`);
  return `${prefix}\n${lines.join("\n")}`;
}

export function formatAmbiguousTaskPick(
  tasks: { title: string }[]
): string {
  return formatTaskPickPrompt(tasks, "A few tasks could match — which one?");
}
