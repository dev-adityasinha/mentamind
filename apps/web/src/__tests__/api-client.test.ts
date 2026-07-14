import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/api/client";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    setAccessToken("initial-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  it("attaches Authorization header when access token is set", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await apiFetch("/me");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const auth = (init?.headers as Headers).get("Authorization");
    expect(auth).toBe("Bearer initial-token");
  });

  it("does not attach Authorization header when skipAuth is true", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    await apiFetch("/auth/register", { skipAuth: true });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const auth = (init?.headers as Headers).get("Authorization");
    expect(auth).toBeNull();
  });

  it("retries original request after 401 when refresh succeeds", async () => {
    let apiCallCount = 0;

    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);

      if (urlStr.includes("/api/auth/refresh")) {
        return new Response(JSON.stringify({ access_token: "new-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      apiCallCount += 1;
      if (apiCallCount === 1) {
        return new Response(null, { status: 401 });
      }
      return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
    });

    const res = await apiFetch("/me");

    expect(res.status).toBe(200);
    expect(getAccessToken()).toBe("new-token");
    // original call + retry
    expect(apiCallCount).toBe(2);
  });

  it("clears access token and returns 401 response when refresh fails after 401", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/auth/refresh")) {
        return new Response(null, { status: 401 });
      }
      return new Response(null, { status: 401 });
    });

    const res = await apiFetch("/me");

    expect(res.status).toBe(401);
    expect(getAccessToken()).toBeNull();
  });

  it("does not retry on 401 when skipAuth is set", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const res = await apiFetch("/some-endpoint", { skipAuth: true });

    expect(res.status).toBe(401);
    // Only one fetch call - no refresh attempt
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
