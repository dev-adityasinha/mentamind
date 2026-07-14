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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
