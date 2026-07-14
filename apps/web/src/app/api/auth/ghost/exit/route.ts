import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const GHOST_REFRESH_COOKIE = "mm_ghost_refresh";

export async function POST(): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json({ detail: "API_URL is not configured. Set API_URL in environment variables." }, { status: 503 });
  }
  const cookieStore = cookies();
  const ghostRefreshToken = cookieStore.get(GHOST_REFRESH_COOKIE)?.value;

  if (ghostRefreshToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: ghostRefreshToken }),
      });
    } catch {
      // Ignore errors if the backend is unreachable during logout
    }
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete(GHOST_REFRESH_COOKIE);
  return res;
}
