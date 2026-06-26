import { prisma } from "@/lib/prisma";
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
    `You've been assigned #${input.taskShortId} *${input.taskTitle}* in *${input.workspaceName}*.\n` +
    `Open: ${taskUrl(input.workspaceId, input.taskShortId)}`;

  await sendWhatsAppText(assignee.phone, body);
}
