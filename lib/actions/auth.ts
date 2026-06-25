"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  resolvePostAuthRedirect,
  storeOAuthReturn,
} from "@/lib/oauth-return";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase-server";
import { ServiceError } from "@/lib/services/project";
import {
  normalizeUsername,
  validateUsernameFormat,
} from "@/lib/username";
import { isUsernameTaken } from "@/lib/username-server";

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
    username: normalizeUsername(String(formData.get("username") ?? "")),
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
  const { email, password, username } = readCredentials(formData);
  if (!email || !password) return { error: "Email and password are required" };
  if (!username) return { error: "Username is required" };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  try {
    validateUsernameFormat(username);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Invalid username",
    };
  }
  if (await isUsernameTaken(username)) {
    return { error: `Username "${username}" is already taken` };
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

  if (data.user) {
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: { username, email },
      create: { id: data.user.id, email, username },
    });
  }

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
