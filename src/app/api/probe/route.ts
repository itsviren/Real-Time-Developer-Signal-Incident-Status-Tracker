import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { authorized } from "@/lib/security";
import { configured, database } from "@/lib/supabase-server";
import { MONITORS } from "@/lib/monitors";
import { probeAll } from "@/lib/probe";
import { deliverAlerts } from "@/lib/alerts";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32)
    return Response.json(
      { error: "Cron secret is not configured" },
      { status: 503 },
    );
  if (!authorized(req.headers.get("authorization"), process.env.CRON_SECRET))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!configured())
    return Response.json(
      { error: "Database is not configured" },
      { status: 503 },
    );
  const db = database(),
    token = randomUUID();
  try {
    const lease = await db.rpc("acquire_probe", { p_token: token });
    if (lease.error) throw new Error("Lease failed");
    if (!lease.data)
      return Response.json({ error: "Probe already running" }, { status: 409 });
    after(async () => {
      try {
        const checks = await probeAll(MONITORS);
        const commit = await db.rpc("commit_probe", {
          p_token: token,
          p_monitors: MONITORS,
          p_checks: checks,
        });
        if (commit.error) throw new Error("Probe persistence failed");
        const finish = await db
          .from("probe_runs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            check_count: checks.length,
          })
          .eq("id", token);
        if (finish.error) console.error("Probe completion record failed");
        const release = await db.rpc("release_probe", { p_token: token });
        if (release.error) console.error("Probe lease release failed");
        try {
          await deliverAlerts();
        } catch {
          console.error("Alert processing failed");
        }
        const cleanup = await db.rpc("cleanup_history");
        if (cleanup.error) console.error("Retention cleanup failed");
      } catch {
        console.error("Scheduled probe failed");
        await db
          .from("probe_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error:
              "Probe failed; inspect database configuration and server logs",
          })
          .eq("id", token);
      } finally {
        const release = await db.rpc("release_probe", { p_token: token });
        if (release.error) console.error("Probe lease release failed");
      }
    });
    return Response.json(
      { accepted: true, runId: token, checksScheduled: MONITORS.length },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Unable to schedule probe");
    await db.rpc("release_probe", { p_token: token });
    return Response.json(
      { error: "Unable to schedule probe; check database configuration" },
      { status: 503 },
    );
  }
}
