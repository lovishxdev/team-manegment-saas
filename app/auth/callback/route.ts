import { NextResponse, type NextRequest } from "next/server";
import { getPublicOrigin } from "@/lib/oauth-http";
import {
  clearOAuthReturnCookie,
  readOAuthReturnFromRequest,
} from "@/lib/oauth-return";
import { createSupabaseServer } from "@/lib/supabase-server";

/**
 * OAuth + email-confirmation callback. Supabase redirects here with a
 * one-time code which we exchange for a session (sets the cookies).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // request.url's origin is the local server address (localhost:3000) when
  // behind ngrok/a proxy; derive the public origin from forwarded headers so
  // redirects keep the browser on the domain it started on.
  const origin = getPublicOrigin(request);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");
  const oauthReturn = readOAuthReturnFromRequest(request);

  console.log("[auth/callback]", {
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    hasCode: Boolean(code),
    explicitNext,
    oauthReturn,
    cookieNames: request.cookies.getAll().map((c) => c.name),
  });

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.log("[auth/callback] exchange failed:", error.message);
    }
    if (!error) {
      const destination =
        oauthReturn ??
        (explicitNext?.startsWith("/") && !explicitNext.startsWith("//")
          ? explicitNext
          : "/dashboard");
      const redirect = NextResponse.redirect(`${origin}${destination}`);
      if (oauthReturn) clearOAuthReturnCookie(redirect);
      return redirect;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
