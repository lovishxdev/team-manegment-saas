import type { User } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/project";
import {
  USERNAME_REGEX,
  deriveInitialUsername,
} from "@/lib/username";

export async function isUsernameTaken(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: {
      username,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

/** Picks `preferred` or `preferred_N` until a free handle is found. */
export async function allocateUniqueUsername(
  preferred: string,
  excludeUserId?: string
): Promise<string> {
  let base = preferred.replace(/[^a-z0-9_]/g, "").slice(0, 24);
  if (!USERNAME_REGEX.test(base)) base = "usr";

  for (let suffix = 0; suffix < 10_000; suffix++) {
    const tag = suffix === 0 ? "" : `_${suffix}`;
    const candidate = base.slice(0, Math.max(3, 24 - tag.length)) + tag;
    if (!USERNAME_REGEX.test(candidate)) continue;
    if (!(await isUsernameTaken(candidate, excludeUserId))) return candidate;
  }

  throw new ServiceError("Could not allocate a unique username", "INVALID_INPUT");
}

/** Backfills a missing username (OAuth / legacy rows). */
export async function ensureUserUsername(
  user: User,
  metadata?: Record<string, unknown> | null
): Promise<User> {
  if (user.username) return user;

  const username = await resolveNewUsername({
    userId: user.id,
    email: user.email,
    metadata,
  });
  return prisma.user.update({
    where: { id: user.id },
    data: { username },
  });
}

export async function resolveNewUsername(opts: {
  userId: string;
  email?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<string> {
  const base = deriveInitialUsername(opts);
  return allocateUniqueUsername(base, opts.userId);
}
