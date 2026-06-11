"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { signInAction, type AuthFormState } from "@/lib/actions/auth";
import { AuthCard, Divider } from "@/components/auth-card";
import { OAuthButtons } from "@/components/oauth-buttons";

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
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-500"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm placeholder-zinc-500 outline-none focus:border-indigo-500"
        />
        {state.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-zinc-400">
        No account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="text-indigo-400 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}
