"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { signInAction, type AuthFormState } from "@/lib/actions/auth";
import { AuthCard, Divider } from "@/components/auth/auth-card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { ui } from "@/components/ui/ui";

const initialState: AuthFormState = {};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    deleted?: string;
    error?: string;
    error_description?: string;
  }>;
}) {
  const { next, deleted, error, error_description } = use(searchParams);
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your workspace">
      <OAuthButtons next={next} />
      <Divider />
      {deleted && (
        <p className="mb-3 text-sm text-ink-soft">Your account has been deleted.</p>
      )}
      {error === "auth_callback_failed" && (
        <p className={`mb-3 ${ui.errorText}`}>
          Sign-in could not be completed. Please try again.
        </p>
      )}
      {error && error !== "auth_callback_failed" && (
        <p className={`mb-3 ${ui.errorText}`}>
          {error === "server_error" &&
          error_description?.includes("Database error saving new user")
            ? "That email may already be linked to an existing account. Try signing in with email and password, or use a different GitHub account."
            : (error_description?.replace(/\+/g, " ") ??
              "Sign-in failed. Please try again.")}
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        {next && <input type="hidden" name="next" value={next} />}
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={ui.input}
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className={ui.input}
        />
        {state.error && <p className={ui.errorText}>{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className={`mt-1 w-full ${ui.btnPrimary}`}
        >
          Sign in
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        No account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-ink hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
