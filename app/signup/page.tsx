"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { signUpAction, type AuthFormState } from "@/lib/actions/auth";
import { AuthCard, Divider } from "@/components/auth-card";
import { OAuthButtons } from "@/components/oauth-buttons";
import { ui } from "@/components/ui";

const initialState: AuthFormState = {};

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = use(searchParams);
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <AuthCard title="Create your account" subtitle="Start managing your team">
      <OAuthButtons next={next} />
      <Divider />
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
          name="username"
          type="text"
          required
          minLength={3}
          maxLength={24}
          pattern="[a-z0-9_]{3,24}"
          placeholder="username"
          autoComplete="username"
          className={`${ui.input} font-mono lowercase`}
        />
        <p className="-mt-1 text-xs text-ink-faint">
          3-24 characters: lowercase letters, digits, underscores.
        </p>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          className={ui.input}
        />
        {state.error && <p className={ui.errorText}>{state.error}</p>}
        {state.message && (
          <p className="text-sm text-accent">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`mt-1 ${ui.btnPrimary}`}
        >
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-ink hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
