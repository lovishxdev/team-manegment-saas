import { prisma } from "@/lib/prisma";
import { formatTaskRef } from "@/lib/whatsapp-task-ref";
import { taskUrl } from "@/lib/app-url";
import { sendWhatsAppText } from "@/lib/whatsapp";

/**
 * Proactive WhatsApp pings within Meta's ~24h session window only.
 * We do not use template messages or scheduled reminders — if the assignee
 * hasn't messaged the bot recently, the send may fail silently.
 */
export async function notifyTaskAssigned(input: {
  assigneeUserId: string;
  actorUserId: string;
  workspaceId: string;
  workspaceName: string;
  taskShortId: number;
  taskTitle: string;
}): Promise<void> {
  if (input.assigneeUserId === input.actorUserId) return;

  const assignee = await prisma.user.findUnique({
    where: { id: input.assigneeUserId },
    select: { phone: true },
  });
  if (!assignee?.phone) return;

  const body =
    `You've been assigned ${formatTaskRef(input.taskTitle)} in *${input.workspaceName}*.\n` +
    `Open: ${taskUrl(input.workspaceId, input.taskShortId)}`;

  await sendWhatsAppText(assignee.phone, body);
}

/**
 * Blocker/dependency detected on a task — ping the people whose work it
 * affects (assignees; task creator as fallback). Same session-window
 * constraints as notifyTaskAssigned; failures are silent.
 */
export async function notifyBlockerDetected(input: {
  workspaceId: string;
  workspaceName: string;
  taskId: string;
  taskShortId: number;
  taskTitle: string;
  authorUserId: string | null;
  authorUsername: string | null;
  kindLabel: "Blocker" | "Dependency";
  summary: string;
}): Promise<void> {
  const assignees = await prisma.taskAssignee.findMany({
    where: { taskId: input.taskId },
    select: { user: { select: { id: true, phone: true } } },
  });

  let recipients = assignees
    .map((a) => a.user)
    .filter((u) => u.id !== input.authorUserId && u.phone);

  if (recipients.length === 0) {
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { createdBy: { select: { id: true, phone: true } } },
    });
    const creator = task?.createdBy;
    if (creator?.phone && creator.id !== input.authorUserId) {
      recipients = [creator];
    }
  }
  if (recipients.length === 0) return;

  const via = input.authorUsername ? ` — flagged by @${input.authorUsername}` : "";
  const body =
    `⛔ ${input.kindLabel} on ${formatTaskRef(input.taskTitle)} in *${input.workspaceName}*:\n` +
    `${input.summary}${via}\n` +
    `Open: ${taskUrl(input.workspaceId, input.taskShortId)}`;

  await Promise.allSettled(
    recipients.map((r) => sendWhatsAppText(r.phone as string, body))
  );
}

/**
 * Close the loop: whoever flagged a blocker hears when it's cleared —
 * without having to watch the thread. Skipped when they resolved it
 * themselves. Same session-window constraints as the other pings.
 */
export async function notifyBlockerResolved(input: {
  workspaceId: string;
  authorUserId: string | null;
  resolvedByUserId: string;
  summary: string;
  task: { shortId: number; title: string } | null;
}): Promise<void> {
  if (!input.authorUserId || input.authorUserId === input.resolvedByUserId) {
    return;
  }

  const [author, resolver, workspace] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.authorUserId },
      select: { phone: true },
    }),
    prisma.user.findUnique({
      where: { id: input.resolvedByUserId },
      select: { username: true },
    }),
    prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { name: true },
    }),
  ]);
  if (!author?.phone) return;

  const taskRef = input.task ? ` on ${formatTaskRef(input.task.title)}` : "";
  const by = resolver ? ` by @${resolver.username}` : "";
  const link = input.task
    ? `\nOpen: ${taskUrl(input.workspaceId, input.task.shortId)}`
    : "";
  const body =
    `✅ The blocker you flagged${taskRef} in *${workspace?.name ?? "your workspace"}* was resolved${by}:\n` +
    `"${input.summary}"${link}`;

  await sendWhatsAppText(author.phone, body);
}
