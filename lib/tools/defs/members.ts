import { z } from "zod";
import { Role } from "@/lib/generated/prisma/client";
import {
  demoteMember,
  formatMemberRole,
  getWorkspaceMembers,
  promoteMember,
  resolveWorkspaceMember,
} from "@/lib/services/workspace";
import {
  createWorkspaceInviteLink,
  formatInviteMembersResult,
  formatInvitePreview,
  inviteMembersToWorkspace,
  previewInvites,
  MAX_BATCH_INVITES,
} from "@/lib/services/invites";
import {
  prepareRemoveMember,
  runRemoveMemberConfirmed,
} from "@/lib/bot/extended-tools";
import { formatWorkspaceMemberList } from "@/lib/channel-formatters";
import {
  stageDemoteMember,
  stageInviteMembers,
  stageRemoveMember,
} from "@/lib/whatsapp-pending";
import { displayUser } from "@/lib/username";
import { revalidateUserWorkspaces } from "@/lib/revalidate-nav";
import {
  ok,
  soft,
  requireWorkspace,
  type ToolDef,
} from "@/lib/tools/types";
import { str, workspaceParam } from "@/lib/tools/helpers";

const inviteMembersTool: ToolDef = {
  name: "invite_members",
  waDescription: `Invite people to the workspace by username, email, or phone. Up to ${MAX_BATCH_INVITES} people per request. Shows a preview of who will be invited and asks for confirmation before sending.`,
  mcpDescription: `Invite teammates by username, email, or phone. Up to ${MAX_BATCH_INVITES} per request. ALWAYS call once without confirm to preview who each entry resolves to, show the user, and only call again with confirm=true after they verify the names.`,
  inputShape: {
    members: z
      .array(z.string())
      .min(1)
      .max(MAX_BATCH_INVITES)
      .describe(
        `Usernames, emails, or phone numbers to invite (max ${MAX_BATCH_INVITES})`
      ),
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Set true only after the user verified the resolved names in the preview"
      ),
    workspace: workspaceParam,
  },
  waInputShape: {
    members: z
      .array(z.string())
      .min(1)
      .max(MAX_BATCH_INVITES)
      .describe(
        `Usernames, emails, or phone numbers to invite (max ${MAX_BATCH_INVITES}). Copy each exactly as the user wrote it.`
      ),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const raw = input.members;
    const members = Array.isArray(raw)
      ? raw.map((m) => String(m))
      : String(raw ?? "")
          .split(/[,;\n]+/)
          .map((m) => m.trim())
          .filter(Boolean);
    if (members.length === 0) {
      return soft(
        `Who should I invite? Give usernames, emails, or phone numbers (up to ${MAX_BATCH_INVITES} at once).`
      );
    }

    if (ctx.wa) {
      // Preview + Confirm/Cancel buttons — a fuzzy name match must never
      // silently invite the wrong person.
      const preview = await previewInvites({
        workspaceId: ws.workspaceId,
        inviterUserId: ctx.userId,
        identifiers: members,
      });
      await stageInviteMembers(ctx.wa.session.phone, ctx.userId, {
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        identifiers: members,
      });
      ctx.wa.session.pendingInviteMembers = true;
      return ok(formatInvitePreview(ws.workspaceName, preview.rows, "whatsapp"), {
        staged: true,
      });
    }

    if (input.confirm !== true) {
      const preview = await previewInvites({
        workspaceId: ws.workspaceId,
        inviterUserId: ctx.userId,
        identifiers: members,
      });
      return ok(formatInvitePreview(ws.workspaceName, preview.rows, "mcp"), {
        staged: true,
      });
    }

    const result = await inviteMembersToWorkspace({
      workspaceId: ws.workspaceId,
      inviterUserId: ctx.userId,
      identifiers: members,
    });
    return ok(formatInviteMembersResult(result, ctx.channel));
  },
};

const listWorkspaceMembersTool: ToolDef = {
  name: "list_workspace_members",
  waDescription: "List everyone in the workspace and their roles",
  inputShape: { workspace: workspaceParam },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const { members } = await getWorkspaceMembers(ws.workspaceId, ctx.userId);
    return ok(formatWorkspaceMemberList(ws.workspaceName, members, ctx.channel));
  },
};

const createInviteLinkTool: ToolDef = {
  name: "create_invite_link",
  waDescription:
    "Create a generic invite link anyone can use to join the workspace (leaders/sub-leaders only)",
  mcpDescription:
    "Create a generic invite link anyone can use to join (leaders/sub-leaders only)",
  inputShape: { workspace: workspaceParam },
  run: async (_input, ctx) => {
    const ws = requireWorkspace(ctx);
    const link = await createWorkspaceInviteLink(ws.workspaceId, ctx.userId);
    return ok(
      ctx.channel === "whatsapp"
        ? `Invite link for *${link.workspaceName}* (share with anyone):\n${link.url}`
        : `Invite link for "${link.workspaceName}" (share with anyone): ${link.url}`
    );
  },
};

const promoteMemberTool: ToolDef = {
  name: "promote_member",
  waDescription:
    "Promote a workspace member to sub-leader or leader. Leader only.",
  inputShape: {
    member: z
      .string()
      .min(1)
      .describe("Username, email, or name of the member to promote"),
    role: z
      .enum(["SUB_LEADER", "LEADER"])
      .optional()
      .describe("New role (default SUB_LEADER)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const member = str(input.member);
    if (!member) return soft("Who should I promote?");
    const newRole = input.role === "LEADER" ? Role.LEADER : Role.SUB_LEADER;
    const updated = await promoteMember(ws.workspaceId, ctx.userId, member, newRole);
    if (ctx.wa) revalidateUserWorkspaces(ctx.userId, ws.workspaceId);
    return ok(
      ctx.channel === "whatsapp"
        ? `Promoted @${displayUser(updated.user)} to ${formatMemberRole(updated.role)} in ${ws.workspaceName}.`
        : `Promoted @${displayUser(updated.user)} to ${formatMemberRole(updated.role)} in workspace "${ws.workspaceName}".`
    );
  },
};

const demoteMemberTool: ToolDef = {
  name: "demote_member",
  waDescription:
    "Demote a workspace member to member or sub-leader. Leader only. Sends Confirm/Cancel buttons before applying.",
  mcpDescription:
    "Demote a workspace member to member or sub-leader. Leader only. Call without confirm to preview; call again with confirm=true after the user explicitly agrees.",
  inputShape: {
    member: z
      .string()
      .min(1)
      .describe("Username, email, or name of the member to demote"),
    role: z
      .enum(["MEMBER", "SUB_LEADER"])
      .optional()
      .describe("New role (default MEMBER)"),
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Set true only after the user explicitly confirms demotion in chat"
      ),
    workspace: workspaceParam,
  },
  waInputShape: {
    member: z
      .string()
      .min(1)
      .describe("Username, email, or name of the member to demote"),
    role: z
      .enum(["MEMBER", "SUB_LEADER"])
      .optional()
      .describe("New role (default MEMBER)"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const member = str(input.member);
    if (!member) return soft("Who should I demote?");
    const newRole = input.role === "SUB_LEADER" ? Role.SUB_LEADER : Role.MEMBER;
    const target = await resolveWorkspaceMember(ws.workspaceId, member);

    if (ctx.wa) {
      if (target.userId === ctx.userId) return soft("You cannot demote yourself.");
      if (target.role === newRole) {
        return soft(
          `@${displayUser(target.user)} is already ${formatMemberRole(newRole)}.`
        );
      }
      const rank = { MEMBER: 0, SUB_LEADER: 1, LEADER: 2 };
      if (rank[newRole] >= rank[target.role]) {
        return soft("That is not a demotion — use promote_member instead.");
      }
      await stageDemoteMember(ctx.wa.session.phone, ctx.userId, {
        workspaceId: ws.workspaceId,
        workspaceName: ws.workspaceName,
        targetUserId: target.userId,
        targetLabel: displayUser(target.user),
        currentRole: target.role,
        newRole,
      });
      ctx.wa.session.pendingDemote = true;
      return ok(
        `I'll demote @${displayUser(target.user)} from ${formatMemberRole(target.role)} to ${formatMemberRole(newRole)} — tap Confirm below.`,
        { staged: true }
      );
    }

    if (input.confirm !== true) {
      return ok(
        `Demote @${displayUser(target.user)} from ${formatMemberRole(target.role)} to ${formatMemberRole(newRole)} in workspace "${ws.workspaceName}"?\n\n` +
          `Ask the user to confirm, then call demote_member again with confirm=true.`,
        { staged: true }
      );
    }
    const updated = await demoteMember(ws.workspaceId, ctx.userId, member, newRole);
    return ok(
      `Demoted @${displayUser(updated.user)} to ${formatMemberRole(updated.role)} in workspace "${ws.workspaceName}".`
    );
  },
};

const removeMemberTool: ToolDef = {
  name: "remove_member",
  waDescription:
    "Remove a member from the workspace (leader only). Sends Confirm/Cancel buttons.",
  mcpDescription:
    "Remove a member from the workspace (leader only). Preview first; confirm=true to apply.",
  inputShape: {
    member: z.string().min(1).describe("Username, email, or name"),
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Set true only after the user explicitly confirms removal in chat"
      ),
    workspace: workspaceParam,
  },
  waInputShape: {
    member: z.string().min(1).describe("Username, email, or name"),
    workspace: workspaceParam,
  },
  run: async (input, ctx) => {
    const ws = requireWorkspace(ctx);
    const member = str(input.member);
    if (!member) return soft("Who should I remove from the workspace?");
    const pending = await prepareRemoveMember(ws, ctx.userId, member);

    if (ctx.wa) {
      await stageRemoveMember(ctx.wa.session.phone, ctx.userId, pending);
      ctx.wa.session.pendingRemoveMember = true;
      return ok(
        `I'll remove @${pending.targetLabel} from ${ws.workspaceName} — tap Confirm below.`,
        { staged: true }
      );
    }

    if (input.confirm !== true) {
      return ok(
        `Remove @${pending.targetLabel} from workspace "${ws.workspaceName}"?\n\n` +
          `Ask the user to confirm, then call remove_member again with confirm=true.`,
        { staged: true }
      );
    }
    return ok(await runRemoveMemberConfirmed(pending, ctx.userId, ctx.channel));
  },
};

export const memberTools: ToolDef[] = [
  inviteMembersTool,
  listWorkspaceMembersTool,
  createInviteLinkTool,
  promoteMemberTool,
  demoteMemberTool,
  removeMemberTool,
];
