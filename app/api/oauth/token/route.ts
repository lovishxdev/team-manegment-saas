import { NextRequest } from "next/server";
import { corsJson, corsPreflight } from "@/lib/oauth-http";
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  OAuthError,
} from "@/lib/services/oauth";

/** OAuth token endpoint: authorization_code (PKCE) and refresh_token grants. */
export async function POST(req: NextRequest) {
  let params: URLSearchParams;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    params = new URLSearchParams(
      Object.entries(body).map(([k, v]) => [k, String(v)])
    );
  } else {
    params = new URLSearchParams(await req.text());
  }

  const grantType = params.get("grant_type");
  const clientId = params.get("client_id") ?? "";

  try {
    if (grantType === "authorization_code") {
      const code = params.get("code");
      const codeVerifier = params.get("code_verifier");
      if (!code || !codeVerifier || !clientId) {
        throw new OAuthError(
          "invalid_request",
          "code, code_verifier and client_id are required"
        );
      }
      const tokens = await exchangeAuthorizationCode({
        code,
        clientId,
        redirectUri: params.get("redirect_uri") ?? undefined,
        codeVerifier,
      });
      return corsJson(tokens);
    }

    if (grantType === "refresh_token") {
      const refreshToken = params.get("refresh_token");
      if (!refreshToken || !clientId) {
        throw new OAuthError(
          "invalid_request",
          "refresh_token and client_id are required"
        );
      }
      const tokens = await exchangeRefreshToken({ refreshToken, clientId });
      return corsJson(tokens);
    }

    throw new OAuthError(
      "unsupported_grant_type",
      `Unsupported grant_type: ${grantType}`
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
