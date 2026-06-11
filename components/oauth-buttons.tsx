"use client";

import { signInWithOAuthAction } from "@/lib/actions/auth";

const providers = [
  { id: "github" as const, label: "Continue with GitHub" },
  { id: "google" as const, label: "Continue with Google" },
];

export function OAuthButtons({ next }: { next?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => (
        <button
          key={p.id}
          onClick={() => signInWithOAuthAction(p.id, next)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
