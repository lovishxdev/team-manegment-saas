import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";
import { isValidWorkspaceId } from "@/lib/workspace-id";

/** Minimal workspace header data — one membership + name lookup. */
export const getWorkspaceChrome = cache(
  async (workspaceId: string, userId: string) => {
    if (!isValidWorkspaceId(workspaceId)) {
      throw new ServiceError("Workspace not found", "NOT_FOUND");
    }

    const membership = await getActorMembership(userId, workspaceId);
    if (!membership) {
      throw new ServiceError(
        "You are not a member of this workspace",
        "FORBIDDEN"
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new ServiceError("Workspace not found", "NOT_FOUND");
    }

    return {
      workspace,
      canInvite:
        membership.role === "LEADER" || membership.role === "SUB_LEADER",
    };
  }
);
