import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const REFRESH_COOKIE = "mm_refresh";
const GHOST_REFRESH_COOKIE = "mm_ghost_refresh";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export async function POST(): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json({ detail: "API_URL is not configured. Set API_URL in environment variables." }, { status: 503 });
  }
  const cookieStore = cookies();
  const realRefreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!realRefreshToken) {
    return NextResponse.json({ detail: "Authentication required to enter ghost mode" }, { status: 401 });
  }

  // To spawn a ghost user, we need a real access token.
  // The Next.js API acts as a middleman. Let's first get a fresh real access token using the real refresh token.
  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: realRefreshToken }),
    });
  } catch {
    return NextResponse.json({ detail: "Service unavailable" }, { status: 503 });
  }

  if (!apiRes.ok) {
    return NextResponse.json({ detail: "Session expired" }, { status: 401 });
  }

  const { access_token: realAccessToken } = (await apiRes.json()) as { access_token: string };

  // Now spawn the ghost user
  let spawnRes: Response;
  try {
    spawnRes = await fetch(`${API_URL}/auth/spawn-ghost`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${realAccessToken}`,
      },
    });
  } catch {
    return NextResponse.json({ detail: "Service unavailable" }, { status: 503 });
  }

  if (!spawnRes.ok) {
    const errorData = await spawnRes.json().catch(() => ({ detail: "Failed to spawn ghost" }));
    return NextResponse.json(errorData, { status: spawnRes.status });
  }

  const { access_token, refresh_token } = (await spawnRes.json()) as {
    access_token: string;
    refresh_token: string;
  };

  const res = NextResponse.json({ access_token });
  res.cookies.set(GHOST_REFRESH_COOKIE, refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  
  return res;
}
