import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service-role key.
 *
 * Used for backend operations that bypass RLS (Storage uploads, admin
 * operations). NEVER import this from client-side code -- the service-role
 * key grants full database access.
 *
 * Realtime broadcasting is intentionally not handled here: the web dashboard
 * subscribes to Postgres changes directly via the client-side Supabase SDK,
 * so writes made through Prisma are picked up automatically.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Storage bucket where workspace assets are uploaded. */
export const ASSETS_BUCKET = "assets";
