import { NextRequest } from "next/server";
import { corsJson, corsPreflight } from "@/lib/oauth-http";
import { OAuthError, registerClient } from "@/lib/services/oauth";

/** Dynamic Client Registration (RFC 7591). Public clients only. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return corsJson(
      { error: "invalid_request", error_description: "Body must be JSON" },
      400
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  const clientName =
    typeof body.client_name === "string" && body.client_name.trim()
      ? body.client_name.trim()
      : "MCP Client";

  try {
    const client = await registerClient({ clientName, redirectUris });
    return corsJson(
      {
        client_id: client.id,
        client_name: client.name,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      },
      201
    );
  } catch (err) {
    if (err instanceof OAuthError) {
      return corsJson({ error: err.code, error_description: err.description }, 400);
    }
    throw err;
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
