import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";

/** Minimal workspace header data — one membership + name lookup. */
export const getWorkspaceChrome = cache(
  async (workspaceId: string, userId: string) => {
    const membership = await getActorMembership(userId, workspaceId);
    if (!membership) {
      throw new ServiceError(
        "You are not a member of this workspace",
        "FORBIDDEN"
      );
    }

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });

    return {
      workspace,
      canInvite:
        membership.role === "LEADER" || membership.role === "SUB_LEADER",
    };
  }
);
