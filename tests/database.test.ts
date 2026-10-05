import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const db = new PGlite();
const owner = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002";
async function run(token: string, status: string, incidents: unknown[] = []) {
  await db.query("select public.commit_probe($1,$2::jsonb,$3::jsonb)", [
    token,
    JSON.stringify([
      {
        id: "test",
        name: "Test",
        category: "AI",
        url: "https://example.com",
        type: "incidentio",
      },
    ]),
    JSON.stringify([
      {
        monitor_id: "test",
        status,
        latency_ms: 100,
        status_code: 200,
        checked_at: new Date().toISOString(),
        error: null,
        incidents,
      },
    ]),
  ]);
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create publication supabase_realtime; insert into auth.users values('${owner}'),('${other}');`,
  );
  await db.exec(await readFile("supabase/migrations/001_initial.sql", "utf8"));
}, 60000);
afterAll(async () => {
  await db.close();
});
describe.sequential("PostgreSQL persistence and privacy", () => {
  it("applies the migration and blocks concurrent leases", async () => {
    const token = randomUUID();
    const acquired = await db.query<{ acquire_probe: boolean }>(
      "select acquire_probe($1)",
      [token],
    );
    expect(acquired.rows[0].acquire_probe).toBe(true);
    const second = await db.query<{ acquire_probe: boolean }>(
      "select acquire_probe($1)",
      [randomUUID()],
    );
    expect(second.rows[0].acquire_probe).toBe(false);
    await db.query("select release_probe($1)", [token]);
  });
  it("rejects writes without lease ownership", async () => {
    await expect(run(randomUUID(), "operational")).rejects.toThrow("lease");
  });
  it("deduplicates baseline and repeated alerts, and preserves recovery through unknown", async () => {
    const token = randomUUID();
    await db.query("select acquire_probe($1)", [token]);
    await run(token, "operational");
    await db.query(
      "insert into alert_subscriptions(user_id,monitor_id,destination) values($1,'test','https://discord.com/api/webhooks/123/token')",
      [owner],
    );
    await run(token, "operational");
    expect((await db.query("select * from alert_outbox")).rows).toHaveLength(0);
    await run(token, "outage");
    await run(token, "outage");
    await run(token, "unknown");
    await run(token, "operational");
    expect((await db.query("select * from alert_outbox")).rows).toHaveLength(2);
    await db.query("select release_probe($1)", [token]);
  });
  it("only claims pending deliveries once until claim expiry", async () => {
    expect((await db.query("select * from claim_alerts()")).rows).toHaveLength(
      2,
    );
    expect((await db.query("select * from claim_alerts()")).rows).toHaveLength(
      0,
    );
  });
  it("resolves incident.io reports when absent from a valid summary", async () => {
    const token = randomUUID();
    await db.query("select acquire_probe($1)", [token]);
    await run(token, "degraded", [
      {
        id: "i",
        name: "API issue",
        status: "investigating",
        impact: "minor",
        url: null,
        updated_at: new Date().toISOString(),
        body: "",
      },
    ]);
    await run(token, "operational");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from incidents where id='i'",
        )
      ).rows[0].status,
    ).toBe("resolved");
    await db.query("select release_probe($1)", [token]);
  });
  it("isolates subscriptions and denies authenticated probe execution", async () => {
    await db.exec("set role authenticated");
    try {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        other,
      ]);
      expect(
        (await db.query("select * from alert_subscriptions")).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into alert_subscriptions(user_id,monitor_id,destination) values($1,'test','https://discord.com/api/webhooks/123/token')",
          [owner],
        ),
      ).rejects.toThrow();
      await expect(
        db.query("select acquire_probe($1)", [randomUUID()]),
      ).rejects.toThrow();
      await expect(db.query("select * from alert_outbox")).rejects.toThrow();
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        owner,
      ]);
      expect(
        (await db.query("select * from alert_subscriptions")).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("reset role");
    }
  });
  it("recovers an expired lease and marks abandoned work failed", async () => {
    const abandoned = randomUUID();
    await db.query("select acquire_probe($1)", [abandoned]);
    await db.exec(
      "update probe_leases set expires_at=now()-interval '3 minutes'",
    );
    await db.query(
      "update probe_runs set started_at=now()-interval '3 minutes' where id=$1",
      [abandoned],
    );
    const replacement = randomUUID();
    expect(
      (
        await db.query<{ acquire_probe: boolean }>("select acquire_probe($1)", [
          replacement,
        ])
      ).rows[0].acquire_probe,
    ).toBe(true);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from probe_runs where id=$1",
          [abandoned],
        )
      ).rows[0].status,
    ).toBe("failed");
    await db.query("select release_probe($1)", [replacement]);
  });
  it("removes expired raw history while retaining recent observations", async () => {
    await db.exec(
      "insert into checks(monitor_id,status,status_code,checked_at) values('test','operational',200,now()-interval '31 days')",
    );
    await db.query("select cleanup_history()");
    expect(
      (
        await db.query(
          "select id from checks where checked_at<now()-interval '30 days'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select id from checks")).rows.length,
    ).toBeGreaterThan(0);
  });
});
