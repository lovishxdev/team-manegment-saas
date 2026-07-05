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
  const mode = String(formData.get("mode") ?? "workspace");
  const workspaceIdRaw = String(formData.get("workspace_id") ?? "").trim();

  // Re-validate everything server-side; hidden form fields are untrusted.
  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri) || !codeChallenge) {
    redirect("/oauth/authorize?error=invalid_request");
  }

  // Connection choice: one workspace + context tools (coding agents), or
  // all workspaces + full tools (chat/management).
  let scope = "full";
  let workspaceId: string | null = null;
  if (mode !== "all") {
    const { prisma } = await import("@/lib/prisma");
    const membership = workspaceIdRaw
      ? await prisma.workspaceMembership.findUnique({
          where: {
            userId_workspaceId: { userId: user.id, workspaceId: workspaceIdRaw },
          },
        })
      : null;
    if (!membership) {
      redirect("/oauth/authorize?error=invalid_request");
    }
    scope = "context";
    workspaceId = workspaceIdRaw;
  }

  const code = await createAuthorizationCode({
    clientId,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scope,
    workspaceId,
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
