import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Reads/writes the httpOnly session cookies. Uses the
 * publishable (anon) key -- user identity comes from the session, and RLS
 * applies to any direct reads.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component where cookies are read-only;
            // middleware handles session refresh in that case.
          }
        },
      },
    }
  );
}

/**
 * Supabase client for Route Handlers that must attach session cookies to the
 * outgoing response (OAuth callback, etc.).
 */
export function createSupabaseRouteHandler(request: NextRequest) {
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

  return {
    supabase,
    applyCookies(target: NextResponse) {
      response.cookies.getAll().forEach((cookie) => {
        target.cookies.set(cookie);
      });
      return target;
    },
  };
}
