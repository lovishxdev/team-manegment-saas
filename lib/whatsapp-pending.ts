import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PENDING_TTL_MS = 10 * 60 * 1000;

export type DeleteTaskPending = {
  workspaceId: string;
  workspaceName: string;
  shortId: number;
  taskTitle: string;
};

export type ContinueMessagePending = {
  text: string;
};

export async function stageDeleteTask(
  phone: string,
  userId: string,
  data: DeleteTaskPending
): Promise<void> {
  await upsertPending(phone, userId, "delete_task", data);
}

export async function stageContinueMessage(
  phone: string,
  userId: string,
  text: string
): Promise<void> {
  await upsertPending(phone, userId, "continue_message", { text });
}

async function upsertPending(
  phone: string,
  userId: string,
  action: string,
  payload: Prisma.InputJsonValue
): Promise<void> {
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
  await prisma.whatsAppPendingAction.upsert({
    where: { phone },
    create: { phone, userId, action, payload, expiresAt },
    update: { userId, action, payload, expiresAt },
  });
}

export async function getPendingDelete(
  phone: string,
  userId: string
): Promise<DeleteTaskPending | null> {
  const row = await loadPending(phone, userId, "delete_task");
  return row ? (row.payload as DeleteTaskPending) : null;
}

export async function consumeContinueMessage(
  phone: string,
  userId: string
): Promise<string | null> {
  const row = await loadPending(phone, userId, "continue_message");
  if (!row) return null;
  await clearPending(phone);
  return (row.payload as ContinueMessagePending).text;
}

async function loadPending(phone: string, userId: string, action: string) {
  const row = await prisma.whatsAppPendingAction.findUnique({
    where: { phone },
  });
  if (!row || row.userId !== userId || row.action !== action) return null;
  if (row.expiresAt < new Date()) {
    await clearPending(phone).catch(() => {});
    return null;
  }
  return row;
}

export async function clearPending(phone: string): Promise<void> {
  await prisma.whatsAppPendingAction.deleteMany({ where: { phone } });
}
