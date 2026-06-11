import { prisma } from "@/lib/prisma";

/**
 * WhatsApp conversation memory. Keeps a short rolling window per user so
 * Haiku can resolve follow-up references ("make that one high priority").
 */

const WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours of context
const MAX_TURNS = 12; // messages (user + assistant combined) sent to the model
const KEEP_PER_USER = 30; // stored rows before pruning

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Returns the recent conversation as strictly alternating turns ending
 * with an assistant message (ready to have the new user message appended).
 * Consecutive same-role messages are merged so the Anthropic API never
 * rejects the sequence (e.g. when a previous reply failed to send).
 */
export async function getRecentConversation(
  userId: string
): Promise<ConversationTurn[]> {
  const rows = await prisma.whatsAppMessage.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_TURNS,
  });
  rows.reverse();

  const turns: ConversationTurn[] = [];
  for (const row of rows) {
    const role = row.role === "assistant" ? "assistant" : "user";
    const last = turns[turns.length - 1];
    if (last && last.role === role) {
      last.content += `\n${row.content}`;
    } else {
      turns.push({ role, content: row.content });
    }
  }

  // History must start with a user turn and end with an assistant turn so
  // that appending the new inbound message keeps the sequence valid.
  while (turns.length && turns[0].role === "assistant") turns.shift();
  while (turns.length && turns[turns.length - 1].role === "user") turns.pop();

  return turns;
}

/** Stores one exchange and lazily prunes old rows for the user. */
export async function recordExchange(
  userId: string,
  userText: string,
  assistantText: string
): Promise<void> {
  // Explicit timestamps: both rows are written in one statement, and a
  // shared default now() would make user/assistant ordering ambiguous.
  const now = Date.now();
  await prisma.whatsAppMessage.createMany({
    data: [
      { userId, role: "user", content: userText, createdAt: new Date(now) },
      {
        userId,
        role: "assistant",
        content: assistantText,
        createdAt: new Date(now + 1),
      },
    ],
  });

  const excess = await prisma.whatsAppMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: KEEP_PER_USER,
    select: { id: true },
  });
  if (excess.length > 0) {
    await prisma.whatsAppMessage.deleteMany({
      where: { id: { in: excess.map((row) => row.id) } },
    });
  }
}
