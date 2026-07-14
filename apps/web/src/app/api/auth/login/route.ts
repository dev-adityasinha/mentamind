import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const REFRESH_COOKIE = "mm_refresh";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json({ detail: "API_URL is not configured. Set API_URL in environment variables." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ detail: "Service unavailable" }, { status: 503 });
  }

  const data = (await apiRes.json().catch(() => ({}))) as Record<string, unknown>;

  if (!apiRes.ok) {
    return NextResponse.json(data, { status: apiRes.status });
  }

  const { access_token, refresh_token } = data as {
    access_token: string;
    refresh_token: string;
  };

  const res = NextResponse.json({ access_token });
  res.cookies.set(REFRESH_COOKIE, refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
