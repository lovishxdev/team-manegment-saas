import { NextRequest } from "next/server";
import { corsJson, corsPreflight, getPublicOrigin } from "@/lib/oauth-http";
import { OAUTH_SCOPES } from "@/lib/services/oauth";

/** OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint. */
export async function GET(req: NextRequest) {
  const origin = getPublicOrigin(req);
  return corsJson({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
