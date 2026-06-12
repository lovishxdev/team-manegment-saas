import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Minimal OAuth 2.1 authorization server for MCP clients (claude.ai web +
 * mobile connectors). Authorization-code flow with mandatory PKCE (S256),
 * public clients only (token_endpoint_auth_method: "none").
 */

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MS / 1000;

export const OAUTH_SCOPES = ["tasks:read", "tasks:write"];

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(input: string): string {
  return crypto.createHash("sha256").update(input).digest("base64url");
}

export class OAuthError extends Error {
  constructor(
    public readonly code:
      | "invalid_request"
      | "invalid_client"
      | "invalid_grant"
      | "unsupported_grant_type",
    public readonly description: string
  ) {
    super(description);
    this.name = "OAuthError";
  }
}

/** Dynamic Client Registration (RFC 7591). */
export async function registerClient(input: {
  clientName: string;
  redirectUris: string[];
}) {
  const valid = input.redirectUris.filter((uri) => {
    try {
      const u = new URL(uri);
      return (
        u.protocol === "https:" ||
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1"
      );
    } catch {
      return false;
    }
  });
  if (valid.length === 0) {
    throw new OAuthError(
      "invalid_request",
      "At least one valid https redirect_uri is required"
    );
  }

  return prisma.oAuthClient.create({
    data: { name: input.clientName, redirectUris: valid },
  });
}

export async function getClient(clientId: string) {
  try {
    return await prisma.oAuthClient.findUnique({ where: { id: clientId } });
  } catch {
    return null; // non-UUID client_id
  }
}

/** Issues a single-use authorization code after user consent. */
export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
}) {
  const code = randomToken(32);
  await prisma.oAuthCode.create({
    data: {
      code,
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

async function issueTokens(clientId: string, userId: string) {
  const token = randomToken(48);
  const refreshToken = randomToken(48);
  await prisma.oAuthToken.create({
    data: {
      token,
      refreshToken,
      clientId,
      userId,
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
    },
  });
  return {
    access_token: token,
    token_type: "bearer" as const,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: OAUTH_SCOPES.join(" "),
  };
}

/** authorization_code grant with PKCE verification. Codes are single use. */
export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri?: string;
  codeVerifier: string;
}) {
  const stored = await prisma.oAuthCode.findUnique({
    where: { code: input.code },
  });
  // Single use: delete immediately, even if subsequent validation fails.
  if (stored) {
    await prisma.oAuthCode.delete({ where: { code: input.code } });
  }

  if (!stored || stored.expiresAt < new Date()) {
    throw new OAuthError("invalid_grant", "Authorization code is invalid or expired");
  }
  if (stored.clientId !== input.clientId) {
    throw new OAuthError("invalid_grant", "Code was issued to a different client");
  }
  if (input.redirectUri && stored.redirectUri !== input.redirectUri) {
    throw new OAuthError("invalid_grant", "redirect_uri mismatch");
  }
  if (sha256Base64Url(input.codeVerifier) !== stored.codeChallenge) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }

  return issueTokens(stored.clientId, stored.userId);
}

/** refresh_token grant with rotation. */
export async function exchangeRefreshToken(input: {
  refreshToken: string;
  clientId: string;
}) {
  const stored = await prisma.oAuthToken.findUnique({
    where: { refreshToken: input.refreshToken },
  });
  if (!stored || stored.clientId !== input.clientId) {
    throw new OAuthError("invalid_grant", "Refresh token is invalid");
  }

  await prisma.oAuthToken.delete({ where: { token: stored.token } });
  return issueTokens(stored.clientId, stored.userId);
}

/** Resolves an OAuth access token to a user id, or null. */
export async function verifyOAuthAccessToken(
  bearerToken: string
): Promise<{ userId: string; clientId: string } | null> {
  const stored = await prisma.oAuthToken.findUnique({
    where: { token: bearerToken },
  });
  if (!stored) return null;
  if (stored.expiresAt < new Date()) {
    await prisma.oAuthToken
      .delete({ where: { token: stored.token } })
      .catch(() => {});
    return null;
  }
  return { userId: stored.userId, clientId: stored.clientId };
}
