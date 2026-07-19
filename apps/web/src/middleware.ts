import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/register", "/join", "/api/", "/logo/"];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.cookies.has("mm_refresh")) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude Next.js internals and PWA/service-worker assets. A service worker
  // script must be served directly (not behind a redirect), so sw.js, the
  // workbox runtime, and the web manifest must bypass the auth middleware.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-.*|manifest.webmanifest|manifest.json).*)",
  ],
};
