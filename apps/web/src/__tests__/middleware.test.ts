import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function makeRequest(path: string, cookieHeader?: string): NextRequest {
  const url = `http://localhost${path}`;
  const headers: HeadersInit = cookieHeader
    ? { cookie: cookieHeader }
    : {};
  return new NextRequest(url, { headers });
}

describe("middleware route protection", () => {
  it("redirects to /login when mm_refresh cookie is absent", () => {
    const req = makeRequest("/home");
    const res = middleware(req);
    expect(res.headers.get("location")).toMatch(/\/login$/);
  });

  it("allows the request when mm_refresh cookie is present", () => {
    const req = makeRequest("/home", "mm_refresh=some-opaque-token");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /login without a session cookie", () => {
    const req = makeRequest("/login");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /register without a session cookie", () => {
    const req = makeRequest("/register");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows Next.js API routes without a session cookie", () => {
    const req = makeRequest("/api/auth/refresh");
    const res = middleware(req);
    expect(res.headers.get("location")).toBeNull();
  });
});
