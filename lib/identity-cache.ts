import { prisma } from "@/lib/prisma";
import { createTtlCache } from "@/lib/ttl-cache";

/**
 * Cached identity lookups for the two hottest non-browser paths:
 *  - MCP: every tool call re-verifies the bearer token
 *  - WhatsApp webhook: every message resolves phone -> user
 *
 * Only positive results are cached, and writers (token regeneration, phone
 * change) invalidate eagerly, so the TTL is just a safety net.
 */
const TTL_MS = 60_000;

const byMcpToken = createTtlCache<string>(TTL_MS);
const byPhone = createTtlCache<string>(TTL_MS);

/** Resolve a personal MCP token to a user id (cached). */
export async function getUserIdByMcpToken(
  token: string
): Promise<string | null> {
  const cached = byMcpToken.get(token);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { mcpToken: token },
    select: { id: true },
  });
  if (!user) return null;

  byMcpToken.set(token, user.id);
  return user.id;
}

/** Resolve a WhatsApp phone number (E.164, no +) to a user id (cached). */
export async function getUserIdByPhone(phone: string): Promise<string | null> {
  const cached = byPhone.get(phone);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });
  if (!user) return null;

  byPhone.set(phone, user.id);
  return user.id;
}

export function invalidateMcpToken(token: string | null | undefined) {
  if (token) byMcpToken.delete(token);
}

export function invalidatePhone(phone: string | null | undefined) {
  if (phone) byPhone.delete(phone);
}
