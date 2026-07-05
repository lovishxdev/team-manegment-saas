import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { oauthAuthorizePath } from "@/lib/oauth-return";
import { displayUser } from "@/lib/username";
import { resolveNewUsername, syncUserProfile } from "@/lib/username-server";
import { getClient } from "@/lib/services/oauth";
import {
  approveAuthorizationAction,
  denyAuthorizationAction,
} from "@/lib/actions/oauth";
import { ui } from "@/components/ui/ui";

function ErrorCard({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-red-500/30 bg-card p-8 text-center">
        <h1 className="font-display text-lg font-semibold">
          Authorization error
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{message}</p>
      </div>
    </main>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const supabase = await createSupabaseServer();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authId = claimsData?.claims?.sub;

  if (!authId) {
    // The proxy normally intercepts unauthenticated requests (and stores the
    // OAuth params in a cookie); this is just a render-time fallback. Server
    // Components cannot set cookies, so only the `next` param carries state.
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) qs.set(key, value);
    }
    const search = qs.toString() ? `?${qs}` : "";
    redirect(`/login?next=${encodeURIComponent(oauthAuthorizePath(search))}`);
  }

  let user = await prisma.user.findUnique({ where: { id: authId } });
  const metadata =
    claimsData?.claims?.user_metadata &&
    typeof claimsData.claims.user_metadata === "object" &&
    !Array.isArray(claimsData.claims.user_metadata)
      ? (claimsData.claims.user_metadata as Record<string, unknown>)
      : null;

  if (!user) {
    const email =
      typeof claimsData?.claims?.email === "string"
        ? claimsData.claims.email
        : null;
    const username = await resolveNewUsername({
      userId: authId,
      email,
      metadata,
    });
    user = await prisma.user.create({
      data: { id: authId, email, username },
    });
  } else {
    const email =
      typeof claimsData?.claims?.email === "string"
        ? claimsData.claims.email
        : null;
    user = await syncUserProfile(user, { email, metadata });
  }

  const {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    error,
  } = params;

  if (error) {
    return <ErrorCard message="The authorization request was malformed. Close this window and try connecting again." />;
  }
  if (responseType !== "code") {
    return <ErrorCard message="Unsupported response_type (only 'code' is supported)." />;
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return <ErrorCard message="Missing required parameters (client_id, redirect_uri, code_challenge)." />;
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return <ErrorCard message="Only the S256 PKCE method is supported." />;
  }

  const client = await getClient(clientId);
  if (!client) {
    return <ErrorCard message="Unknown client. Try removing and re-adding the connector." />;
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return <ErrorCard message="The redirect URI is not registered for this client." />;
  }

  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });
  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
  }));

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-card p-8">
        <Image
          src="/euclis-logo.png"
          alt="Euclis"
          width={44}
          height={44}
          className="mx-auto mb-5 rounded-lg ring-1 ring-line"
        />
        <h1 className="text-center font-display text-xl font-semibold tracking-tight">
          Connect {client.name}
        </h1>
        <p className="mt-3 text-center text-sm text-ink-soft">
          <span className="font-medium text-ink">{client.name}</span> wants to
          access Euclis as{" "}
          <span className="font-medium text-ink">@{displayUser(user)}</span>.
        </p>

        <form action={approveAuthorizationAction} className="mt-6">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          {state && <input type="hidden" name="state" value={state} />}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-medium text-ink-soft">
              What can this connection do?
            </legend>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3.5 py-3 text-sm transition-colors hover:bg-paper-deep/40">
              <input
                type="radio"
                name="mode"
                value="workspace"
                defaultChecked
                className="mt-0.5 accent-ink"
              />
              <span>
                <span className="block font-medium text-ink">
                  One workspace (coding agents)
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  Read the board, use project memory, post updates — strictly
                  confined to the workspace below. No deletes or member
                  management.
                </span>
              </span>
            </label>

            {workspaces.length > 0 ? (
              <select
                name="workspace_id"
                defaultValue={workspaces[0].id}
                className={`w-full ${ui.select}`}
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-md border border-dashed border-line px-3 py-2 text-xs text-ink-faint">
                You have no workspaces yet — only the all-workspace option will
                work.
              </p>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3.5 py-3 text-sm transition-colors hover:bg-paper-deep/40">
              <input
                type="radio"
                name="mode"
                value="all"
                className="mt-0.5 accent-ink"
              />
              <span>
                <span className="block font-medium text-ink">
                  All workspaces (chat &amp; management)
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  Full access: create/delete tasks, manage members and
                  workspaces. For chat-style use (e.g. the Claude app).
                </span>
              </span>
            </label>
          </fieldset>

          <button className={`mt-5 w-full ${ui.btnPrimary}`}>
            Allow access
          </button>
        </form>

        <form action={denyAuthorizationAction} className="mt-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          {state && <input type="hidden" name="state" value={state} />}
          <button className={`w-full ${ui.btnSecondary}`}>Deny</button>
        </form>
      </div>
    </main>
  );
}
