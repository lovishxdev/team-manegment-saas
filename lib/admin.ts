import { notFound } from "next/navigation";
import type { User } from "@/lib/generated/prisma/client";
import { requireUser } from "@/lib/auth";

/** Admin UI is local-dev only — never exposed on Vercel (production or previews). */
export function isAdminEnvironment(): boolean {
  if (process.env.VERCEL) return false;
  return process.env.NODE_ENV === "development";
}

function getAdminUserIds(): string[] {
  const raw = process.env.EUCLIS_ADMIN_USER_ID?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdminAccessConfigured(): boolean {
  return getAdminUserIds().length > 0;
}

export function isAdminUser(userId: string): boolean {
  const allowed = getAdminUserIds();
  if (allowed.length === 0) return true;
  return allowed.includes(userId);
}

/** Hostname from DATABASE_URL for the admin banner — never includes credentials. */
export function getDatabaseTargetLabel(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return "not configured";

  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    return parsed.host;
  } catch {
    return "configured";
  }
}

/**
 * Gate for /admin routes. Returns 404 outside local dev or for non-allowlisted users.
 * When EUCLIS_ADMIN_USER_ID is unset, any signed-in local user may access (dev convenience).
 */
export async function requireAdmin(): Promise<User> {
  if (!isAdminEnvironment()) notFound();

  const user = await requireUser();
  if (!isAdminUser(user.id)) notFound();

  return user;
}
