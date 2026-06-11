"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { signUpAction, type AuthFormState } from "@/lib/actions/auth";
import { AuthCard, Divider } from "@/components/auth-card";
import { OAuthButtons } from "@/components/oauth-buttons";

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
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-500"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-500"
        />
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state.message && (
          <p className="text-sm text-emerald-400">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-indigo-400 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
