"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  resolvePostAuthRedirect,
  storeOAuthReturn,
} from "@/lib/oauth-return";
import { createSupabaseServer } from "@/lib/supabase-server";

export type AuthFormState = { error?: string; message?: string };

async function getOrigin() {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only allow same-site relative paths as post-auth destinations. */
function safeNext(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Email and password are required" };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(await resolvePostAuthRedirect(String(formData.get("next") ?? "")));
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Email and password are required" };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const next = safeNext(formData.get("next"));
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Email-confirmation links flow through the callback and land on `next`
      emailRedirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message };

  // If email confirmations are disabled, a session exists already.
  if (data.session) redirect(await resolvePostAuthRedirect(next));

  return {
    message: "Check your email for a confirmation link to finish signing up.",
  };
}

export async function signInWithOAuthAction(
  provider: "github" | "google",
  next?: string
) {
  const destination = safeNext(next);
  // Long OAuth-consent destinations get stripped from Supabase's redirect_to
  // round trip, so persist them in a cookie the callback can read instead.
  await storeOAuthReturn(destination);
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${await getOrigin()}/auth/callback?next=${encodeURIComponent(destination)}`,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth_failed");
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
