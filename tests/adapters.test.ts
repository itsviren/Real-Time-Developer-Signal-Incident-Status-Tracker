import { describe, it, expect } from "vitest";
import { parseFeed } from "../src/lib/adapters";
import { MONITORS } from "../src/lib/monitors";
import { probe } from "../src/lib/probe";
const github = MONITORS[0];
describe("provider interpretation", () => {
  it("distinguishes degraded provider reports from outages", () => {
    expect(
      parseFeed(github, JSON.stringify({ status: { indicator: "minor" } }))
        .status,
    ).toBe("degraded");
    expect(
      parseFeed(github, JSON.stringify({ status: { indicator: "critical" } }))
        .status,
    ).toBe("outage");
  });
  it("does not assume malformed payloads are operational", () => {
    expect(parseFeed(github, "{}").status).toBe("unknown");
  });
  it("includes active maintenance but not future maintenance", () => {
    const result = parseFeed(
      github,
      JSON.stringify({
        status: { indicator: "none" },
        scheduled_maintenances: [
          { id: "active", name: "Network", status: "in_progress" },
          { id: "future", name: "Tomorrow", status: "scheduled" },
        ],
      }),
    );
    expect(result.status).toBe("maintenance");
    expect(result.incidents.map((i) => i.id)).toEqual(["active"]);
  });
  it("supports current incident.io summaries and active maintenance", () => {
    const monitor = MONITORS.find((m) => m.type === "incidentio")!;
    expect(
      parseFeed(
        monitor,
        JSON.stringify({ ongoing_incidents: [], in_progress_maintenances: [] }),
      ).status,
    ).toBe("operational");
    expect(
      parseFeed(
        monitor,
        JSON.stringify({
          ongoing_incidents: [{ id: "i", name: "API errors" }],
          in_progress_maintenances: [],
        }),
      ).status,
    ).toBe("degraded");
    expect(
      parseFeed(
        monitor,
        JSON.stringify({
          ongoing_incidents: [],
          in_progress_maintenances: [{ id: "m", name: "Network maintenance" }],
        }),
      ).status,
    ).toBe("maintenance");
    expect(parseFeed(monitor, "{}").status).toBe("unknown");
  });
  it("supports Atom feeds with official incident links", () => {
    const rss = MONITORS.find((m) => m.id === "stripe")!;
    const result = parseFeed(
      rss,
      '<feed><entry><id>incident1</id><title>API restored</title><updated>2026-10-05T01:00:00Z</updated><link href="https://status.stripe.com/incidents/1"/></entry></feed>',
      new Date("2026-10-05T02:00:00Z"),
    );
    expect(result.incidents[0].url).toBe(
      "https://status.stripe.com/incidents/1",
    );
    expect(result.status).toBe("unknown");
  });
  it("bounds and sanitizes incident URLs", () => {
    const value = parseFeed(
      github,
      JSON.stringify({
        status: { indicator: "none" },
        incidents: [
          {
            id: "1",
            name: "Incident",
            status: "investigating",
            shortlink: "javascript:alert(1)",
          },
        ],
      }),
    );
    expect(value.incidents[0].url).toBeNull();
  });
  it("does not interpret stale RSS posts as active outages", () => {
    const rss = MONITORS.find((m) => m.type === "rss")!;
    const result = parseFeed(
      rss,
      "<rss><channel><item><title>Service Degradation</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>",
      new Date("2026-10-05"),
    );
    expect(result.status).toBe("unknown");
    expect(result.incidents).toHaveLength(0);
  });
  it("preserves explicit recent RSS resolutions without asserting global health", () => {
    const result = parseFeed(
      MONITORS.find((m) => m.type === "rss")!,
      "<rss><channel><item><title>Service restored</title><pubDate>Mon, 05 Oct 2026 01:00:00 GMT</pubDate></item></channel></rss>",
      new Date("2026-10-05T02:00:00Z"),
    );
    expect(result.incidents[0].status).toBe("resolved");
    expect(result.status).toBe("unknown");
  });
  it("treats network and HTTP errors as unknown, with no fake latency", async () => {
    const fake = async () => new Response("Forbidden", { status: 403 });
    const result = await probe(github, fake as typeof fetch);
    expect(result.status).toBe("unknown");
    expect(result.status_code).toBe(403);
    expect(result.latency_ms).toBeNull();
  });
  it("treats invalid JSON as unknown", async () => {
    const result = await probe(
      github,
      (async () => new Response("bad json")) as typeof fetch,
    );
    expect(result.status).toBe("unknown");
  });
  it("rejects oversized feeds", async () => {
    const result = await probe(
      github,
      (async () => new Response("a".repeat(1_000_001))) as typeof fetch,
    );
    expect(result.error).toContain("1 MB");
  });
});
