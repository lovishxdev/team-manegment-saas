import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Returns the authenticated user's profile row, or redirects to /login.
 *
 * Auth check is a local JWT validation (getClaims, no network round trip).
 * The profile is read-only on the hot path; the create fallback only fires
 * on a user's very first request if the handle_new_user trigger is missing.
 */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) redirect("/login");

  const existing = await prisma.user.findUnique({
    where: { id: claims.sub },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    },
  });
}
