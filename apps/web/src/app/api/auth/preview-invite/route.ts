import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;

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
    apiRes = await fetch(`${API_URL}/invitations/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ detail: "Service unavailable" }, { status: 503 });
  }

  const data = (await apiRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(data, { status: apiRes.status });
}
