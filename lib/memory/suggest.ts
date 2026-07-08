import { prisma } from "@/lib/prisma";
import { sendWhatsAppButtons } from "@/lib/whatsapp-messages";
import { BUTTON } from "@/lib/whatsapp-interactive";
import { formatTaskRef } from "@/lib/whatsapp-task-ref";
import {
  resolveMemoryEvent,
  suppressMemorySuggestions,
  type MemoryEventRow,
} from "@/lib/services/memory";
import { ServiceError } from "@/lib/services/project";
import { bumpMemoryMetric } from "@/lib/memory/metrics";

/**
 * Confirm-only resolution suggestions. Nothing here ever resolves a blocker;
 * it asks the person whose activity likely cleared it, and they confirm with
 * one tap (or via resolve_blocker / the web UI).
 *
 * Anti-irritation rules: max 2 suggestions per blocker lifetime, 1h cooldown,
 * permanent silence after a decline, and the ask always rides an existing
 * conversation (never a standalone ping to someone who wasn't involved).
 */

const MAX_SUGGESTIONS_PER_EVENT = 2;
const SUGGESTION_COOLDOWN_MS = 60 * 60 * 1000;

export type ClaimedSuggestion = {
  eventId: string;
  kind: "BLOCKER" | "DEPENDENCY";
  summary: string;
  taskTitle: string | null;
};

/**
 * Check the anti-irritation throttles for an event and, if an ask is
 * allowed, consume one suggestion slot (increment + timestamp). Used by the
 * in-editor ask (agent hooks) so it shares the same budget as WhatsApp —
 * whichever channel asks first, the user is never double-nagged.
 */
export async function claimResolutionSuggestion(
  eventId: string
): Promise<ClaimedSuggestion | null> {
  const event = await prisma.memoryEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      status: true,
      kind: true,
      summary: true,
      suggestionsSuppressed: true,
      suggestionCount: true,
      lastSuggestedAt: true,
      task: { select: { title: true } },
    },
  });
  if (!event || event.status !== "OPEN") return null;
  if (event.kind !== "BLOCKER" && event.kind !== "DEPENDENCY") return null;
  if (event.suggestionsSuppressed) return null;
  if (event.suggestionCount >= MAX_SUGGESTIONS_PER_EVENT) return null;
  if (
    event.lastSuggestedAt &&
    Date.now() - event.lastSuggestedAt.getTime() < SUGGESTION_COOLDOWN_MS
  ) {
    return null;
  }

  await prisma.memoryEvent.update({
    where: { id: event.id },
    data: {
      suggestionCount: { increment: 1 },
      lastSuggestedAt: new Date(),
    },
  });

  return {
    eventId: event.id,
    kind: event.kind,
    summary: event.summary,
    taskTitle: event.task?.title ?? null,
  };
}

export async function suggestBlockerResolution(input: {
  eventId: string;
  /** TaskUpdate that triggered the suggestion; agent sessions have none. */
  triggerUpdateId?: string;
  /** The user whose activity likely resolved the blocker — the one we ask. */
  triggerUserId: string;
}): Promise<void> {
  const event = await prisma.memoryEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      kind: true,
      summary: true,
      suggestionsSuppressed: true,
      suggestionCount: true,
      lastSuggestedAt: true,
      task: { select: { shortId: true, title: true } },
    },
  });
  if (!event || event.status !== "OPEN") return;
  if (event.suggestionsSuppressed) return;
  if (event.suggestionCount >= MAX_SUGGESTIONS_PER_EVENT) return;
  if (
    event.lastSuggestedAt &&
    Date.now() - event.lastSuggestedAt.getTime() < SUGGESTION_COOLDOWN_MS
  ) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: input.triggerUserId },
    select: { phone: true, whatsappChatInitiatedAt: true },
  });
  // Only deliverable channel today is the WhatsApp chat the user already has
  // open with the bot. MCP sessions get the deterministic open-blocker nudge
  // in tool responses instead (see formatOpenBlockerNudge).
  if (!user?.phone || !user.whatsappChatInitiatedAt) return;

  const taskRef = event.task ? ` on ${formatTaskRef(event.task.title)}` : "";
  const kindLabel = event.kind === "DEPENDENCY" ? "dependency" : "blocker";
  const body =
    `That sounds like it might clear the ${kindLabel}${taskRef}:\n` +
    `"${event.summary}"\n\nMark it resolved?`;

  const sent = await sendWhatsAppButtons(user.phone, body, [
    { id: BUTTON.memoryResolveConfirm(event.id), title: "✅ Resolved" },
    { id: BUTTON.memoryResolveDismiss(event.id), title: "Not yet" },
  ]);
  if (!sent) return;

  bumpMemoryMetric(event.workspaceId, "resolution_ask");

  await prisma.memoryEvent.update({
    where: { id: event.id },
    data: {
      suggestionCount: { increment: 1 },
      lastSuggestedAt: new Date(),
    },
  });
}

/** "✅ Resolved" button tap — the human confirmation that closes the loop. */
export async function confirmSuggestedResolution(
  eventId: string,
  userId: string
): Promise<string> {
  const event = await prisma.memoryEvent.findUnique({
    where: { id: eventId },
    select: { workspaceId: true, summary: true, status: true },
  });
  if (!event) return "That blocker no longer exists — nothing to resolve.";
  if (event.status === "RESOLVED") {
    return "Already resolved — you're all set. ✅";
  }

  try {
    await resolveMemoryEvent({
      workspaceId: event.workspaceId,
      userId,
      eventId,
    });
  } catch (err) {
    return err instanceof ServiceError
      ? err.message
      : "Couldn't resolve that blocker. Try again.";
  }
  return `Resolved ✅ — "${event.summary}"`;
}

/** "Not yet" button tap — never auto-ask about this blocker again. */
export async function dismissSuggestedResolution(
  eventId: string
): Promise<string> {
  const event = await prisma.memoryEvent.findUnique({
    where: { id: eventId },
    select: { workspaceId: true },
  });
  if (event) {
    await suppressMemorySuggestions(event.workspaceId, eventId);
  }
  return "Got it — I won't ask about this one again. You can still resolve it anytime from the task or by telling me.";
}

/**
 * Deterministic nudge appended to tool responses (MCP coding agents) when a
 * task with open blockers is touched — pull-based channels can't be pinged,
 * so the ask rides the response the agent was already getting.
 */
export function formatOpenBlockerNudge(events: MemoryEventRow[]): string {
  if (events.length === 0) return "";
  const lines = events.map(
    (e) => `- [${e.kind}] ${e.summary} (memory event id: ${e.id})`
  );
  return (
    `\n\nOpen blockers on this task:\n${lines.join("\n")}\n` +
    `If your work addresses one of these, confirm with the user, then call ` +
    `resolve_blocker with the event id (or post an update explaining what cleared it).`
  );
}
