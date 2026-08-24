import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "./app/lib/supabase-middleware";

// Routes that require ANY logged-in user.
const PROTECTED_ROUTES = ["/dashboard", "/events/create", "/lost-found/create"];

// Routes that require the logged-in user's profile.role === "admin".
const ADMIN_ROUTES = ["/admin"];

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname } = request.nextUrl;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsAuth = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const needsAdmin = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  // Not logged in but hitting a route that requires a session -> bounce to /login.
  if ((needsAuth || needsAdmin) && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Logged in but hitting an admin-only route -> confirm role server-side.
  if (needsAdmin && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

// Only run middleware on the routes we care about (keeps public pages fast).
export const config = {
  matcher: ["/dashboard/:path*", "/events/create", "/lost-found/create", "/admin/:path*"],
};
