import { NextRequest } from "next/server";
import { corsJson, corsPreflight, getPublicOrigin } from "@/lib/oauth-http";
import { OAUTH_SCOPES } from "@/lib/services/oauth";

/** OAuth 2.0 Authorization Server Metadata (RFC 8414). */
export async function GET(req: NextRequest) {
  const origin = getPublicOrigin(req);
  return corsJson({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: OAUTH_SCOPES,
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
