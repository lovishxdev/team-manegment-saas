import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvite } from "@/lib/services/workspace";
import { createSupabaseServer } from "@/lib/supabase-server";
import { JoinButton } from "@/components/members/join-button";
import { ui } from "@/components/ui/ui";

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
      <div className="w-full max-w-sm rounded-lg border border-line bg-card p-8 text-center">
        <Image
          src="/euclis-logo.png"
          alt="Euclis"
          width={44}
          height={44}
          className="mx-auto mb-5 rounded-lg ring-1 ring-line"
        />
        <p className="text-sm text-ink-soft">You&apos;ve been invited to join</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {invite.workspace.name}
        </h1>

        <div className="mt-6">
          {!invite.valid ? (
            <p className="text-sm text-red-300">
              {invite.expired
                ? "This invite has expired."
                : "This invite has no uses left."}{" "}
              Ask a workspace leader for a new link.
            </p>
          ) : user ? (
            <JoinButton inviteId={invite.id} />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="mb-2 text-sm text-ink-soft">
                Sign in or create an account to join.
              </p>
              <Link
                href={`/login?next=/invite/${invite.id}`}
                className={`text-center ${ui.btnPrimary}`}
              >
                Sign in
              </Link>
              <Link
                href={`/signup?next=/invite/${invite.id}`}
                className={`text-center ${ui.btnSecondary}`}
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
