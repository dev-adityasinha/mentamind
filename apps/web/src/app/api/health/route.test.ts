import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const response = GET();
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
  });
});
