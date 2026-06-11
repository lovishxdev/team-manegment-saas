import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvite } from "@/lib/services/workspace";
import { createSupabaseServer } from "@/lib/supabase-server";
import { JoinButton } from "@/components/join-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;
  const invite = await getInvite(inviteId);
  if (!invite) notFound();

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center shadow-xl">
        <p className="text-sm text-zinc-400">You&apos;ve been invited to join</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {invite.workspace.name}
        </h1>

        <div className="mt-6">
          {!invite.valid ? (
            <p className="text-sm text-red-400">
              {invite.expired
                ? "This invite has expired."
                : "This invite has no uses left."}{" "}
              Ask a workspace leader for a new link.
            </p>
          ) : user ? (
            <JoinButton inviteId={invite.id} />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="mb-2 text-sm text-zinc-400">
                Sign in or create an account to join.
              </p>
              <Link
                href={`/login?next=/invite/${invite.id}`}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Sign in
              </Link>
              <Link
                href={`/signup?next=/invite/${invite.id}`}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
