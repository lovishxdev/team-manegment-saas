import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth";

export function AppNav({ email }: { email: string | null }) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            Teams
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/dashboard" className="transition hover:text-zinc-100">
              Workspaces
            </Link>
            <Link href="/settings" className="transition hover:text-zinc-100">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email && <span className="hidden text-xs text-zinc-500 sm:block">{email}</span>}
          <form action={signOutAction}>
            <button className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
