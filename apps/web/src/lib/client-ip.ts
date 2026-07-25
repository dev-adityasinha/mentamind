import type { NextRequest } from "next/server";

/**
 * The originating client's IP, as far as this server can tell.
 *
 * Returns null when nothing upstream identified the client — which is the
 * normal case for a browser talking straight to the Node server in local dev,
 * since Next.js does not expose the socket address to route handlers.
 */
export function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Left-most entry is the original client; the rest are intermediate proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return req.ip ?? null;
}

/**
 * Add X-Forwarded-For to headers bound for the API.
 *
 * These route handlers proxy server-side, so without this the API sees the web
 * container as the peer for every request and a per-IP rate limit becomes a
 * single bucket shared by all users. Only set when the client is actually
 * known — a placeholder would merge distinct clients under one key just the
 * same, and the API ignores the header unless BEHIND_PROXY is set.
 */
export function withClientIp(
  req: NextRequest,
  headers: Record<string, string>,
): Record<string, string> {
  const ip = clientIp(req);
  return ip ? { ...headers, "X-Forwarded-For": ip } : headers;
}
