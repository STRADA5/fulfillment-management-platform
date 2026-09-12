import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/administration");

  if (isProtectedRoute && !data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
    return redirectResponse;
  }

  return response;
}
