"use client";

import { signInWithOAuthAction } from "@/lib/actions/auth";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden>
      <path d="M12 1.27a11 11 0 0 0-3.48 21.46c.55.09.73-.24.73-.53v-1.85c-3.03.66-3.67-1.45-3.67-1.45-.5-1.29-1.21-1.63-1.21-1.63-.99-.68.07-.66.07-.66 1.1.08 1.67 1.13 1.67 1.13.97 1.66 2.54 1.18 3.16.9.1-.7.38-1.18.69-1.45-2.42-.28-4.96-1.21-4.96-5.4 0-1.19.42-2.17 1.12-2.93-.11-.28-.49-1.39.11-2.89 0 0 .92-.29 3 1.12a10.38 10.38 0 0 1 5.46 0c2.08-1.41 3-1.12 3-1.12.6 1.5.22 2.61.11 2.89.7.76 1.12 1.74 1.12 2.93 0 4.2-2.55 5.12-4.98 5.39.39.34.74 1 .74 2.02v2.99c0 .29.18.63.74.53A11 11 0 0 0 12 1.27Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.19 7.19 0 0 1 0-4.58V6.62H1.29a12.04 12.04 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

const providers = [
  { id: "github" as const, label: "Continue with GitHub", icon: <GitHubIcon /> },
  { id: "google" as const, label: "Continue with Google", icon: <GoogleIcon /> },
];

export function OAuthButtons({ next }: { next?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => (
        <button
          key={p.id}
          onClick={() => signInWithOAuthAction(p.id, next)}
          className="flex w-full items-center justify-center gap-2.5 rounded-md border border-line-strong bg-card px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink/50 hover:bg-card-high"
        >
          {p.icon}
          {p.label}
        </button>
      ))}
    </div>
  );
}
