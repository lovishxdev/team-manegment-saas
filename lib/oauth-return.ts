import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Short-lived cookie holding the OAuth authorize query string through login. */
export const OAUTH_RETURN_COOKIE = "oauth_authorize_return";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 600,
  path: "/",
};

export function oauthAuthorizePath(search: string): string {
  if (!search) return "/oauth/authorize";
  return search.startsWith("?")
    ? `/oauth/authorize${search}`
    : `/oauth/authorize?${search}`;
}

/** Persist Claude's authorize query (e.g. `?response_type=code&client_id=…`). */
export function setOAuthReturnCookie(
  response: NextResponse,
  search: string
): void {
  if (!search) return;
  response.cookies.set(
    OAUTH_RETURN_COOKIE,
    encodeURIComponent(search),
    COOKIE_OPTS
  );
}

export function clearOAuthReturnCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_RETURN_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
}

export function readOAuthReturnFromRequest(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): string | null {
  const raw = request.cookies.get(OAUTH_RETURN_COOKIE)?.value;
  if (!raw) return null;
  try {
    return oauthAuthorizePath(decodeURIComponent(raw));
  } catch {
    return oauthAuthorizePath(raw);
  }
}

/**
 * Store the OAuth return from a Server Action (e.g. right before handing the
 * browser to Google). `destination` is a path like "/oauth/authorize?...".
 */
export async function storeOAuthReturn(destination: string): Promise<void> {
  if (!destination.startsWith("/oauth/authorize?")) return;
  const search = destination.slice("/oauth/authorize".length);
  const jar = await cookies();
  jar.set(OAUTH_RETURN_COOKIE, encodeURIComponent(search), COOKIE_OPTS);
}

/** Prefer stored OAuth return, then an explicit `next`, else dashboard. */
export async function resolvePostAuthRedirect(
  explicitNext?: string | null
): Promise<string> {
  const jar = await cookies();
  const stored = jar.get(OAUTH_RETURN_COOKIE)?.value;
  if (stored) {
    jar.delete(OAUTH_RETURN_COOKIE);
    try {
      return oauthAuthorizePath(decodeURIComponent(stored));
    } catch {
      return oauthAuthorizePath(stored);
    }
  }

  const value = typeof explicitNext === "string" ? explicitNext : "";
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}
