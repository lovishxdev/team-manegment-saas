"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { signInAction, type AuthFormState } from "@/lib/actions/auth";
import { AuthCard, Divider } from "@/components/auth-card";
import { OAuthButtons } from "@/components/oauth-buttons";
import { ui } from "@/components/ui";

const initialState: AuthFormState = {};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = use(searchParams);
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your workspace">
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
          className={`mt-1 ${ui.btnPrimary}`}
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        No account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-accent hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
