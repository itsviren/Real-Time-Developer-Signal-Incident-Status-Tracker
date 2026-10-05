import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  after: vi.fn(),
  probeAll: vi.fn(),
  deliver: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/supabase-server", () => ({
  configured: () => true,
  database: () => ({ rpc: mocks.rpc, from: () => ({ update: mocks.update }) }),
}));
vi.mock("@/lib/probe", () => ({ probeAll: mocks.probeAll }));
vi.mock("@/lib/alerts", () => ({ deliverAlerts: mocks.deliver }));
import { POST } from "../src/app/api/probe/route";
const secret = "x".repeat(32),
  request = () =>
    new Request("http://localhost/api/probe", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", secret);
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.eq.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.probeAll.mockResolvedValue([]);
  mocks.deliver.mockResolvedValue({ delivered: 0, failed: 0 });
});
afterEach(() => vi.unstubAllEnvs());
describe("scheduled request lifecycle", () => {
  it("acknowledges acceptance before doing provider work", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect((await response.json()).accepted).toBe(true);
    expect(mocks.probeAll).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.probeAll).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("commit_probe", expect.any(Object));
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });
  it("does not start overlapping jobs", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("rejects unauthorized requests before acquiring a lease", async () => {
    expect(
      (
        await POST(
          new Request("http://localhost/api/probe", { method: "POST" }),
        )
      ).status,
    ).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("records a background failure without claiming completed work", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.probeAll.mockRejectedValueOnce(new Error("test failure"));
    await POST(request());
    await mocks.after.mock.calls[0][0]();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("release_probe", expect.any(Object));
    vi.restoreAllMocks();
  });
});
