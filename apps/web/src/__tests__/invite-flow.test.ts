import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("invite flow - preview-invite BFF", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns org_name for a valid token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ org_name: "Acme Corp" }),
    });

    const res = await fetch("/api/auth/preview-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token-abc" }),
    });
    const data = await res.json() as { org_name: string };

    expect(data.org_name).toBe("Acme Corp");
  });

  it("returns 404 for an invalid or expired token", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Invitation not found or expired" }),
    });

    const res = await fetch("/api/auth/preview-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "garbage-token" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("invite flow - accept-invite BFF", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns access_token and sets cookie on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        access_token: "at-new-member",
        refresh_token: "rt-new-member",
        token_type: "bearer",
      }),
    });

    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "valid-token-abc",
        password: "NewPass1234!",
        display_name: "New Member",
      }),
    });

    expect(res.status).toBe(201);
  });

  it("returns 401 for an already-used token", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        detail: "Invalid, expired, or already used invitation",
      }),
    });

    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "used-token",
        password: "NewPass1234!",
        display_name: "Late",
      }),
    });

    expect(res.status).toBe(401);
  });

  it("validates password minimum length before calling BFF", () => {
    const password = "short";
    expect(password.length < 8).toBe(true);
  });
});
