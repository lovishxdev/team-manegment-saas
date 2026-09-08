/**
 * Demo auto-login (DEMO_LOGIN=true).
 *
 * When enabled, unauthenticated requests sign in as the seeded demo user
 * via real Supabase email/password so cookies, RLS, and requireUser() work.
 * Never set DEMO_LOGIN on a public production deployment.
 */

export function isDemoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN === "true";
}

export function getDemoLoginCredentials(): {
  email: string;
  password: string;
} | null {
  if (!isDemoLoginEnabled()) return null;
  const email = process.env.DEMO_LOGIN_EMAIL?.trim();
  const password = process.env.DEMO_LOGIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}
