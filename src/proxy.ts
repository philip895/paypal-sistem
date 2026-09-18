import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed the `middleware` convention to `proxy`. This only does
// a cheap cookie-presence check (session signature verification happens
// server-side on each page/action, which also needs full crypto + DB
// access) — its job is just to bounce obviously-unauthenticated requests
// away from the dashboard before they render.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");

  if (!hasSession && request.nextUrl.pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
