import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  readOAuthReturnFromRequest,
  setOAuthReturnCookie,
  clearOAuthReturnCookie,
} from "@/lib/oauth-return";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth",
  "/invite",
  "/landing",
  "/guides",
  "/compare",
  "/privacy",
  "/terms",
  "/llms.txt",
  "/.well-known",
];

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users to /login for protected pages.
 *
 * API routes are excluded via the matcher: MCP and the WhatsApp webhook
 * have their own auth (bearer token / webhook signature).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims validates the JWT locally (cached JWKS) instead of a network
  // round trip to Supabase Auth on every navigation, and still refreshes
  // expired sessions. Do not remove.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ? { id: data.claims.sub } : null;

  const { pathname } = request.nextUrl;

  // SEO + PWA metadata must stay public (no auth redirect).
  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-icon.png" ||
    pathname === "/icon.svg" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/llms.txt" ||
    pathname === "/opengraph-image"
  ) {
    return response;
  }
  // falls back to the Site URL, landing the one-time auth code on "/". Route
  // it to the callback handler so the code is exchanged and the pending
  // OAuth consent (cookie) is honored instead of silently dropped.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // "/" is the public landing page (it redirects signed-in users itself).
  const isPublic =
    pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the full destination including query (OAuth authorize
    // requests carry client_id/state/PKCE params in the query string).
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(url);
    // Cookie survives Google/GitHub OAuth where nested query params in
    // `next` can be dropped by the Supabase callback round trip.
    if (pathname === "/oauth/authorize" && request.nextUrl.search) {
      setOAuthReturnCookie(redirect, request.nextUrl.search);
    }
    return redirect;
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const oauthReturn = readOAuthReturnFromRequest(request);
    const next = request.nextUrl.searchParams.get("next");
    const destination =
      oauthReturn ??
      (next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    if (oauthReturn) clearOAuthReturnCookie(redirect);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except api routes, static files and assets
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon.png|icon.svg|sitemap.xml|robots.txt|llms.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
