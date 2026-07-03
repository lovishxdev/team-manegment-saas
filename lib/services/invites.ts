import { inviteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { isWithinWhatsAppMessagingWindow } from "@/lib/whatsapp-session";
import { sendWhatsAppButtons } from "@/lib/whatsapp-messages";
import { BUTTON } from "@/lib/whatsapp-interactive";
import { ServiceError } from "@/lib/services/project";
import { getWorkspaceMembers, createInvite } from "@/lib/services/workspace";
import { displayUser, USERNAME_REGEX, normalizeUsername } from "@/lib/username";

export const MAX_BATCH_INVITES = 8;

export type InviteMemberOutcome = {
  identifier: string;
  status:
    | "sent_whatsapp"
    | "share_link"
    | "already_member"
    | "not_found"
    | "error";
  message: string;
  inviteUrl?: string;
};

export type InviteMembersResult = {
  workspaceName: string;
  outcomes: InviteMemberOutcome[];
};

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function looksLikePhone(raw: string): boolean {
  const digits = normalizePhoneDigits(raw);
  return digits.length >= 10 && digits.length <= 15;
}

async function findUserByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (looksLikePhone(trimmed)) {
    const phone = normalizePhoneDigits(trimmed);
    const byPhone = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, username: true, email: true, phone: true },
    });
    if (byPhone) return byPhone;
  }

  if (trimmed.includes("@")) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: trimmed, mode: "insensitive" } },
      select: { id: true, username: true, email: true, phone: true },
    });
    if (byEmail) return byEmail;
  }

  const username = normalizeUsername(trimmed);
  if (USERNAME_REGEX.test(username)) {
    const byUsername = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, email: true, phone: true },
    });
    if (byUsername) return byUsername;
  }

  const needle = trimmed.toLowerCase();
  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: needle, mode: "insensitive" } },
        { email: { contains: needle, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, email: true, phone: true },
    take: 5,
  });
  if (candidates.length === 1) return candidates[0];
  return null;
}

async function sendDirectedWhatsAppInvite(input: {
  inviteePhone: string;
  inviteId: string;
  inviterLabel: string;
  workspaceName: string;
}): Promise<boolean> {
  return sendWhatsAppButtons(
    input.inviteePhone,
    `${input.inviterLabel} invited you to join *${input.workspaceName}* on Euclis.\n\n(If you don't know this person, tap Decline.)`,
    [
      { id: BUTTON.inviteAccept(input.inviteId), title: "✅ Accept" },
      { id: BUTTON.inviteDecline(input.inviteId), title: "✖ Decline" },
    ],
    {
      header: "Workspace invite",
      footer: "Reject unknown invites",
    }
  );
}

export async function inviteMembersToWorkspace(input: {
  workspaceId: string;
  inviterUserId: string;
  identifiers: string[];
}): Promise<InviteMembersResult> {
  const unique = [
    ...new Set(
      input.identifiers.map((id) => id.trim()).filter(Boolean)
    ),
  ];

  if (unique.length === 0) {
    throw new ServiceError(
      "Provide at least one username, email, or phone number to invite.",
      "INVALID_INPUT"
    );
  }
  if (unique.length > MAX_BATCH_INVITES) {
    throw new ServiceError(
      `You can invite at most ${MAX_BATCH_INVITES} people in one message.`,
      "INVALID_INPUT"
    );
  }

  await getWorkspaceMembers(input.workspaceId, input.inviterUserId);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: input.workspaceId },
    select: { name: true },
  });

  const inviter = await prisma.user.findUniqueOrThrow({
    where: { id: input.inviterUserId },
    select: { username: true, email: true },
  });
  const inviterLabel = displayUser(inviter);

  const outcomes: InviteMemberOutcome[] = [];

  for (const identifier of unique) {
    try {
      const user = await findUserByIdentifier(identifier);

      if (!user) {
        const invite = await createInvite(input.workspaceId, input.inviterUserId, {
          maxUses: 1,
          expiresInHours: 72,
        });
        const url = inviteUrl(invite.id);
        outcomes.push({
          identifier,
          status: "not_found",
          message: `No account found for "${identifier}". Share this invite link with them: ${url}`,
          inviteUrl: url,
        });
        continue;
      }

      const existing = await prisma.workspaceMembership.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: input.workspaceId,
          },
        },
      });
      if (existing) {
        outcomes.push({
          identifier,
          status: "already_member",
          message: `@${displayUser(user)} is already in ${workspace.name}.`,
        });
        continue;
      }

      const invite = await createInvite(input.workspaceId, input.inviterUserId, {
        maxUses: 1,
        expiresInHours: 72,
      });
      const url = inviteUrl(invite.id);
      const label = displayUser(user);

      if (!user.phone) {
        outcomes.push({
          identifier,
          status: "share_link",
          message: `@${label} has no WhatsApp number on file. Share this invite link with them: ${url}`,
          inviteUrl: url,
        });
        continue;
      }

      const inWindow = await isWithinWhatsAppMessagingWindow(user.id);
      if (!inWindow) {
        outcomes.push({
          identifier,
          status: "share_link",
          message: `Messaging @${label} on WhatsApp isn't available right now (outside the 24-hour window). Please share this invite link with them: ${url}`,
          inviteUrl: url,
        });
        continue;
      }

      const sent = await sendDirectedWhatsAppInvite({
        inviteePhone: user.phone,
        inviteId: invite.id,
        inviterLabel,
        workspaceName: workspace.name,
      });

      if (!sent) {
        outcomes.push({
          identifier,
          status: "share_link",
          message: `Could not reach @${label} on WhatsApp. Share this invite link instead: ${url}`,
          inviteUrl: url,
        });
        continue;
      }

      outcomes.push({
        identifier,
        status: "sent_whatsapp",
        message: `Invite sent to @${label} on WhatsApp (Accept / Decline buttons).`,
        inviteUrl: url,
      });
    } catch (err) {
      outcomes.push({
        identifier,
        status: "error",
        message:
          err instanceof ServiceError
            ? err.message
            : `Could not invite "${identifier}".`,
      });
    }
  }

  return { workspaceName: workspace.name, outcomes };
}

export function formatInviteMembersResult(
  result: InviteMembersResult,
  channel: "whatsapp" | "mcp"
): string {
  const lines = result.outcomes.map((o) => {
    const prefix =
      o.status === "sent_whatsapp"
        ? "✅"
        : o.status === "already_member"
          ? "ℹ️"
          : o.status === "error"
            ? "❌"
            : "🔗";
    return `${prefix} ${o.message}`;
  });

  const header =
    channel === "whatsapp"
      ? `*Invite results · ${result.workspaceName}*`
      : `Invite results for "${result.workspaceName}"`;

  return `${header}\n\n${lines.join("\n")}`;
}

export async function createWorkspaceInviteLink(
  workspaceId: string,
  userId: string
): Promise<{ inviteId: string; url: string; workspaceName: string }> {
  const invite = await createInvite(workspaceId, userId);
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true },
  });
  return {
    inviteId: invite.id,
    url: inviteUrl(invite.id),
    workspaceName: workspace.name,
  };
}
