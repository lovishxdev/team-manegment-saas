import type { ConversationTurn } from "@/lib/services/conversation";

/** User reporting progress — task name optional when context is clear. */
export const PROGRESS_REPORT =
  /^(?:i\s+)?(?:have\s+)?(?:just\s+)?(?:started|finished|completed|blocked|shipped|deployed|sent|posted|published|wrote|made|done with)\b/i;

export function isProgressReport(text: string): boolean {
  return PROGRESS_REPORT.test(text.trim());
}

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

const AFFIRMATION =
  /^(yes|yeah|yep|yup|sure|ok|okay|do it|post it|go ahead|please do|sounds good)\b/i;

export function isAffirmationOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return AFFIRMATION.test(t) || /^yes[,.\s!]*i want to\b/i.test(t);
}

/** Body for add_task_update when the model omits it but intent is clear. */
export function resolveTaskUpdateBody(
  toolBody: unknown,
  userMessage: string,
  turns: ConversationTurn[]
): string {
  const fromTool = String(toolBody ?? "").trim();
  if (fromTool) return fromTool;

  const user = userMessage.trim();
  if (user && !isAffirmationOnly(user)) return user;

  if (user && isAffirmationOnly(user)) {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role !== "assistant") continue;
      const offered = turns[i].content.match(
        /(?:want to post|should i post|post)\s+(?:that\s+)?(.+?)\?/i
      );
      if (offered?.[1]) {
        let text = offered[1].trim();
        text = text.replace(/^that\s+you['']ve\s+/i, "I've ");
        text = text.replace(/^you['']ve\s+/i, "I've ");
        text = text.replace(/\s+on it\.?$/i, "");
        return text;
      }
    }
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role !== "user") continue;
      const prev = turns[i].content.trim();
      if (prev && !isAffirmationOnly(prev)) return prev;
    }
  }

  return "";
}
