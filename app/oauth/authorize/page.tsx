import { requireUser } from "@/lib/auth";
import { getClient } from "@/lib/services/oauth";
import {
  approveAuthorizationAction,
  denyAuthorizationAction,
} from "@/lib/actions/oauth";

function ErrorCard({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-zinc-900/60 p-8 text-center">
        <h1 className="text-lg font-semibold">Authorization error</h1>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
      </div>
    </main>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Middleware guarantees a session; this resolves the profile.
  const user = await requireUser();
  const params = await searchParams;

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
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-xl">
        <h1 className="text-center text-lg font-semibold tracking-tight">
          Connect {client.name}
        </h1>
        <p className="mt-3 text-center text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">{client.name}</span> wants
          to access your workspaces as{" "}
          <span className="font-medium text-zinc-200">{user.email}</span>.
        </p>

        <ul className="mt-5 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
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
            <button className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Allow access
            </button>
          </form>
          <form action={denyAuthorizationAction}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            {state && <input type="hidden" name="state" value={state} />}
            <button className="w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500">
              Deny
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
