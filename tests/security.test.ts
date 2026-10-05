import { describe, it, expect } from "vitest";
import { authorized, validWebhook, shouldAlert } from "../src/lib/security";
describe("cron and outbound safety", () => {
  it("requires exact bearer authentication and a long secret", () => {
    const key = "x".repeat(32);
    expect(authorized(`Bearer ${key}`, key)).toBe(true);
    expect(authorized(`Bearer ${key}x`, key)).toBe(false);
    expect(authorized(null, key)).toBe(false);
    expect(authorized("Bearer short", "short")).toBe(false);
  });
  it("allows only canonical Discord webhook destinations", () => {
    expect(validWebhook("https://discord.com/api/webhooks/123/abc_DEF-9")).toBe(
      true,
    );
    for (const url of [
      "http://discord.com/api/webhooks/123/abc",
      "https://discord.com.evil.test/api/webhooks/123/abc",
      "https://127.0.0.1/api/webhooks/123/abc",
      "https://discord.com/api/webhooks/123/abc?redirect=x",
      "https://x@discord.com/api/webhooks/123/abc",
      "https://discord.com:8080/api/webhooks/123/abc",
    ])
      expect(validWebhook(url)).toBe(false);
  });
  it("alerts on known transitions, not baselines or retrieval failures", () => {
    expect(shouldAlert(undefined, "outage")).toBe(false);
    expect(shouldAlert("operational", "unknown")).toBe(false);
    expect(shouldAlert("unknown", "outage")).toBe(false);
    expect(shouldAlert("operational", "operational")).toBe(false);
    expect(shouldAlert("operational", "outage")).toBe(true);
    expect(shouldAlert("outage", "operational")).toBe(true);
  });
});
