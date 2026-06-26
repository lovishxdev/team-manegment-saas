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
          access your workspaces as{" "}
          <span className="font-medium text-ink">@{displayUser(user)}</span>.
        </p>

        <ul className="mt-5 space-y-2 rounded-md border border-line bg-paper-deep p-4 text-sm text-ink-soft">
          <li>· View your task boards</li>
          <li>· Create and update tasks</li>
          <li>· Delete tasks</li>
        </ul>

        <div className="mt-6 flex flex-col gap-2">
          <form action={approveAuthorizationAction}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            {state && <input type="hidden" name="state" value={state} />}
            <button className={`w-full ${ui.btnPrimary}`}>Allow access</button>
          </form>
          <form action={denyAuthorizationAction}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            {state && <input type="hidden" name="state" value={state} />}
            <button className={`w-full ${ui.btnSecondary}`}>Deny</button>
          </form>
        </div>
      </div>
    </main>
  );
}
