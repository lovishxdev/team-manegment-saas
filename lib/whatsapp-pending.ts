import { prisma } from "@/lib/prisma";

const PENDING_TTL_MS = 10 * 60 * 1000;

export type DeleteTaskPending = {
  workspaceId: string;
  workspaceName: string;
  shortId: number;
  taskTitle: string;
};

export async function stageDeleteTask(
  phone: string,
  userId: string,
  data: DeleteTaskPending
): Promise<void> {
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
  await prisma.whatsAppPendingAction.upsert({
    where: { phone },
    create: {
      phone,
      userId,
      action: "delete_task",
      payload: data,
      expiresAt,
    },
    update: {
      userId,
      action: "delete_task",
      payload: data,
      expiresAt,
    },
  });
}

export async function getPendingDelete(
  phone: string,
  userId: string
): Promise<DeleteTaskPending | null> {
  const row = await prisma.whatsAppPendingAction.findUnique({
    where: { phone },
  });
  if (!row || row.userId !== userId || row.action !== "delete_task") return null;
  if (row.expiresAt < new Date()) {
    await clearPending(phone).catch(() => {});
    return null;
  }
  return row.payload as DeleteTaskPending;
}

export async function clearPending(phone: string): Promise<void> {
  await prisma.whatsAppPendingAction.deleteMany({ where: { phone } });
}
