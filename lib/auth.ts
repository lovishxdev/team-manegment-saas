import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@/lib/generated/prisma/client";
import { scheduleBackgroundTask } from "@/lib/background-task";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  resolveNewUsername,
  syncUserProfile,
} from "@/lib/username-server";

type SessionClaims = {
  sub: string;
  email: string | null;
  metadata: Record<string, unknown> | null;
};

function parseSessionClaims(claims: Record<string, unknown>): SessionClaims {
  const metadata =
    claims.user_metadata &&
    typeof claims.user_metadata === "object" &&
    !Array.isArray(claims.user_metadata)
      ? (claims.user_metadata as Record<string, unknown>)
      : null;

  return {
    sub: claims.sub as string,
    email: typeof claims.email === "string" ? claims.email : null,
    metadata,
  };
}

/**
 * Local JWT validation only — no DB. Redirects to /login when unauthenticated.
 * Use in layouts that must gate access but should not block on profile reads.
 */
export const getSessionClaims = cache(async function getSessionClaims(): Promise<SessionClaims> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  return parseSessionClaims(claims as Record<string, unknown>);
});

const getOrCreateUser = cache(async function getOrCreateUser(): Promise<User> {
  const { sub, email, metadata } = await getSessionClaims();

  const existing = await prisma.user.findUnique({
    where: { id: sub },
  });
  if (existing) return existing;

  const username = await resolveNewUsername({
    userId: sub,
    email,
    metadata,
  });

  return prisma.user.create({
    data: {
      id: sub,
      email,
      username,
    },
  });
});

/**
 * Profile row without awaiting metadata sync — for shell chrome streamed via Suspense.
 * Profile sync is deferred so first paint is not blocked on username/email writes.
 */
export const requireUserLite = cache(async function requireUserLite(): Promise<User> {
  const claims = await getSessionClaims();
  const user = await getOrCreateUser();

  scheduleBackgroundTask("sync-user-profile", () =>
    syncUserProfile(user, {
      email: claims.email,
      metadata: claims.metadata,
    })
  );

  return user;
});

/**
 * Returns the authenticated user's profile row, or redirects to /login.
 *
 * Auth check is a local JWT validation (getClaims, no network round trip).
 * The profile is read-only on the hot path; the create fallback only fires
 * on a user's very first request if the handle_new_user trigger is missing.
 *
 * Wrapped in React.cache so layouts, pages, and nested components can all
 * call it within one render pass at the cost of a single DB query.
 */
export const requireUser = cache(async function requireUser(): Promise<User> {
  const claims = await getSessionClaims();
  const user = await getOrCreateUser();
  return syncUserProfile(user, {
    email: claims.email,
    metadata: claims.metadata,
  });
});
