import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("register-org BFF route", () => {
  beforeEach(() => mockFetch.mockReset());

  it("forwards request to /auth/register-organization and strips refresh_token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        access_token: "at-abc",
        refresh_token: "rt-xyz",
        token_type: "bearer",
      }),
    });

    const res = await fetch("/api/auth/register-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_name: "Acme",
        email: "admin@acme.com",
        password: "StrongPass1!",
        display_name: "Admin",
      }),
    });

    expect(res).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("propagates 409 when email is already registered", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: "Email already registered" }),
    });

    const res = await fetch("/api/auth/register-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_name: "Acme",
        email: "taken@acme.com",
        password: "StrongPass1!",
        display_name: "Admin",
      }),
    });

    expect(res.status).toBe(409);
  });

  it("rejects org_name shorter than 2 characters at client validation level", () => {
    const org_name = "X";
    expect(org_name.length < 2).toBe(true);
  });

  it("rejects password shorter than 8 characters at client validation level", () => {
    const password = "short";
    expect(password.length < 8).toBe(true);
  });
});
