import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * Returns the authenticated user's profile row, or redirects to /login.
 *
 * The profile normally exists already (created by the handle_new_user
 * trigger on auth.users), but we upsert as a safety net so the app also
 * works on databases where supabase/setup.sql hasn't been applied.
 */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: {},
    create: {
      id: authUser.id,
      email: authUser.email ?? null,
    },
  });

  return user;
}
