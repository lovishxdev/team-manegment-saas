"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAuthorizationCode, getClient } from "@/lib/services/oauth";

function buildRedirect(
  redirectUri: string,
  params: Record<string, string>
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function approveAuthorizationAction(formData: FormData) {
  const user = await requireUser();

  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const state = formData.get("state");

  // Re-validate everything server-side; hidden form fields are untrusted.
  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri) || !codeChallenge) {
    redirect("/oauth/authorize?error=invalid_request");
  }

  const code = await createAuthorizationCode({
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
  });

  redirect(
    buildRedirect(redirectUri, {
      code,
      ...(state ? { state: String(state) } : {}),
    })
  );
}

export async function denyAuthorizationAction(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = formData.get("state");

  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    redirect("/dashboard");
  }

  redirect(
    buildRedirect(redirectUri, {
      error: "access_denied",
      ...(state ? { state: String(state) } : {}),
    })
  );
}
