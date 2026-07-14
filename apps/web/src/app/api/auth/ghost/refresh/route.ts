import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const GHOST_REFRESH_COOKIE = "mm_ghost_refresh";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export async function POST(): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json({ detail: "API_URL is not configured. Set API_URL in environment variables." }, { status: 503 });
  }
  const cookieStore = cookies();
  const ghostRefreshToken = cookieStore.get(GHOST_REFRESH_COOKIE)?.value;

  if (!ghostRefreshToken) {
    return NextResponse.json({ detail: "No ghost session" }, { status: 401 });
  }

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: ghostRefreshToken }),
    });
  } catch {
    return NextResponse.json({ detail: "Service unavailable" }, { status: 503 });
  }

  if (!apiRes.ok) {
    const res = NextResponse.json({ detail: "Ghost session expired" }, { status: 401 });
    res.cookies.delete(GHOST_REFRESH_COOKIE);
    return res;
  }

  const data = (await apiRes.json()) as {
    access_token: string;
    refresh_token: string;
  };

  const res = NextResponse.json({ access_token: data.access_token });
  res.cookies.set(GHOST_REFRESH_COOKIE, data.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
