import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const REFRESH_COOKIE = "mm_refresh";

export async function POST(): Promise<NextResponse> {
  if (!API_URL) {
    return NextResponse.json({ detail: "API_URL is not configured. Set API_URL in environment variables." }, { status: 503 });
  }
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
