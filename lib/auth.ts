import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  ensureUserUsername,
  resolveNewUsername,
} from "@/lib/username-server";

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
export const requireUser = cache(async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  const metadata =
    claims.user_metadata &&
    typeof claims.user_metadata === "object" &&
    !Array.isArray(claims.user_metadata)
      ? (claims.user_metadata as Record<string, unknown>)
      : null;

  const existing = await prisma.user.findUnique({
    where: { id: claims.sub },
  });
  if (existing) return ensureUserUsername(existing, metadata);

  const email = typeof claims.email === "string" ? claims.email : null;
  const username = await resolveNewUsername({
    userId: claims.sub,
    email,
    metadata,
  });

  return prisma.user.create({
    data: {
      id: claims.sub,
      email,
      username,
    },
  });
});
