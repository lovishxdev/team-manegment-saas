import { NextResponse, type NextRequest } from "next/server";
import { getPublicOrigin } from "@/lib/oauth-http";
import {
  clearOAuthReturnCookie,
  readOAuthReturnFromRequest,
} from "@/lib/oauth-return";
import { createSupabaseRouteHandler } from "@/lib/supabase-server";

/**
 * OAuth + email-confirmation callback. Supabase redirects here with a
 * one-time code which we exchange for a session (sets the cookies).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getPublicOrigin(request);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");
  const oauthReturn = readOAuthReturnFromRequest(request);
  const providerError = searchParams.get("error");
  const providerErrorDescription = searchParams.get("error_description");

  if (providerError) {
    const params = new URLSearchParams({ error: providerError });
    if (providerErrorDescription) {
      params.set("error_description", providerErrorDescription);
    }
    return NextResponse.redirect(`${origin}/login?${params}`);
  }

  if (code) {
    const { supabase, applyCookies } = createSupabaseRouteHandler(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination =
        oauthReturn ??
        (explicitNext?.startsWith("/") && !explicitNext.startsWith("//")
          ? explicitNext
          : "/dashboard");
      const redirect = applyCookies(
        NextResponse.redirect(`${origin}${destination}`)
      );
      if (oauthReturn) clearOAuthReturnCookie(redirect);
      return redirect;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
