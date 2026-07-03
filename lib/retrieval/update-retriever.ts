import { prisma } from "@/lib/prisma";
import { getActorMembership, ServiceError } from "@/lib/services/project";

export type UpdateRetrievalHit = {
  id: string;
  body: string;
  createdAt: Date;
  score: number;
  author: { username: string; email: string | null };
};

/**
 * All task updates for context (newest last).
 *
 * Pre-scale: pass the full thread to the model so nothing is dropped.
 * When threads get long, re-enable semantic filtering here.
 */
export async function retrieveRelevantUpdates(input: {
  workspaceId: string;
  userId: string;
  taskId: string;
  query?: string;
  limit?: number;
}): Promise<UpdateRetrievalHit[]> {
  const membership = await getActorMembership(
    input.userId,
    input.workspaceId
  );
  if (!membership) {
    throw new ServiceError(
      "You are not a member of this workspace",
      "FORBIDDEN"
    );
  }

  void input.query;
  void input.limit;

  const updates = await prisma.taskUpdate.findMany({
    where: { taskId: input.taskId, workspaceId: input.workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { username: true, email: true } },
    },
  });

  return updates.map((u) => ({
    id: u.id,
    body: u.body,
    createdAt: u.createdAt,
    score: 1,
    author: u.author,
  }));
}
