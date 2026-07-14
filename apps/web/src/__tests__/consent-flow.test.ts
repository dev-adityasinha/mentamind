import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken, clearAccessToken } from "@/lib/api/client";
import { completeOnboarding, updateConsent } from "@/lib/api/onboarding";

const mockUser = {
  id: "user-uuid",
  org_id: "org-uuid",
  display_name: "Test User",
  role: "employee",
  consent_analytics: true,
  consent_ai_coaching: false,
  onboarding_completed_at: "2024-01-01T00:00:00Z",
  created_at: "2024-01-01T00:00:00Z",
  last_active_at: null,
};

describe("onboarding consent flow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    setAccessToken("test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAccessToken();
  });

  it("sends correct payload to POST /onboarding/complete", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = {
      consent_analytics: true,
      consent_ai_coaching: false,
    };

    await completeOnboarding(payload);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/onboarding/complete");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  it("includes optional display_name when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await completeOnboarding({
      consent_analytics: false,
      consent_ai_coaching: false,
      display_name: "Jane Smith",
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.display_name).toBe("Jane Smith");
    expect(body.consent_analytics).toBe(false);
    expect(body.consent_ai_coaching).toBe(false);
  });

  it("sends bearer token in Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await completeOnboarding({ consent_analytics: true, consent_ai_coaching: true });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const auth = (init?.headers as Headers).get("Authorization");
    expect(auth).toBe("Bearer test-token");
  });

  it("sends PATCH to /me/consent with only the changed fields", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockUser), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await updateConsent({ consent_analytics: false });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/me/consent");
    expect(init?.method).toBe("PATCH");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({ consent_analytics: false });
    expect(body).not.toHaveProperty("consent_ai_coaching");
  });
});
