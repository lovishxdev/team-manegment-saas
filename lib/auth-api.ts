import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { syncUserProfile } from "@/lib/username-server";

export async function requireApiUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const metadata =
    claims.user_metadata &&
    typeof claims.user_metadata === "object" &&
    !Array.isArray(claims.user_metadata)
      ? (claims.user_metadata as Record<string, unknown>)
      : null;

  const email = typeof claims.email === "string" ? claims.email : null;

  const existing = await prisma.user.findUnique({
    where: { id: claims.sub },
  });
  if (existing) {
    return syncUserProfile(existing, { email, metadata });
  }

  return null;
}
