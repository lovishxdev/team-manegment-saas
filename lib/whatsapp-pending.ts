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

export type DemoteMemberPending = {
  workspaceId: string;
  workspaceName: string;
  targetUserId: string;
  targetLabel: string;
  currentRole: string;
  newRole: string;
};

export type RemoveMemberPending = {
  workspaceId: string;
  workspaceName: string;
  targetUserId: string;
  targetLabel: string;
};

export type DeleteAssetPending = {
  workspaceId: string;
  workspaceName: string;
  assetId: string;
  fileName: string;
};

export type InviteMembersPending = {
  workspaceId: string;
  workspaceName: string;
  identifiers: string[];
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

export async function stageDemoteMember(
  phone: string,
  userId: string,
  data: DemoteMemberPending
): Promise<void> {
  await upsertPending(phone, userId, "demote_member", data);
}

export async function stageRemoveMember(
  phone: string,
  userId: string,
  data: RemoveMemberPending
): Promise<void> {
  await upsertPending(phone, userId, "remove_member", data);
}

export async function stageDeleteAsset(
  phone: string,
  userId: string,
  data: DeleteAssetPending
): Promise<void> {
  await upsertPending(phone, userId, "delete_asset", data);
}

export async function stageInviteMembers(
  phone: string,
  userId: string,
  data: InviteMembersPending
): Promise<void> {
  await upsertPending(phone, userId, "invite_members", data);
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

export async function getPendingDemote(
  phone: string,
  userId: string
): Promise<DemoteMemberPending | null> {
  const row = await loadPending(phone, userId, "demote_member");
  return row ? (row.payload as DemoteMemberPending) : null;
}

export async function getPendingRemoveMember(
  phone: string,
  userId: string
): Promise<RemoveMemberPending | null> {
  const row = await loadPending(phone, userId, "remove_member");
  return row ? (row.payload as RemoveMemberPending) : null;
}

export async function getPendingDeleteAsset(
  phone: string,
  userId: string
): Promise<DeleteAssetPending | null> {
  const row = await loadPending(phone, userId, "delete_asset");
  return row ? (row.payload as DeleteAssetPending) : null;
}

export async function getPendingInviteMembers(
  phone: string,
  userId: string
): Promise<InviteMembersPending | null> {
  const row = await loadPending(phone, userId, "invite_members");
  return row ? (row.payload as InviteMembersPending) : null;
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

/** Read staged message without consuming (workspace picker flow). */
export async function peekContinueMessage(
  phone: string,
  userId: string
): Promise<string | null> {
  const row = await loadPending(phone, userId, "continue_message");
  if (!row) return null;
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
