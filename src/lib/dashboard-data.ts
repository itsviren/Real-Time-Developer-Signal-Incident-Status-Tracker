import "server-only";
import { database } from "./supabase-server";
import { MONITORS } from "./monitors";
import type { DashboardData, HistoryPoint, Incident, Status } from "./types";
export async function liveDashboard(): Promise<DashboardData> {
  const db = database();
  const since = new Date(Date.now() - 86400000).toISOString();
  const [snap, inc, checks] = await Promise.all([
    db.from("snapshots").select("*").limit(100),
    db
      .from("incidents")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(40),
    db
      .from("checks")
      .select("monitor_id,status,latency_ms,checked_at")
      .gte("checked_at", since)
      .order("checked_at", { ascending: false })
      .limit(1000),
  ]);
  for (const q of [snap, inc, checks])
    if (q.error) throw new Error(q.error.message);
  const services = MONITORS.map((m) => {
    const s = snap.data?.find((s) => s.monitor_id === m.id);
    return {
      ...m,
      status: (s?.status ?? "unknown") as Status,
      latency_ms: s?.latency_ms ?? null,
      checked_at: s?.checked_at ?? null,
      error: s?.error ?? null,
      history: (checks.data ?? [])
        .filter((c) => c.monitor_id === m.id)
        .slice(0, 48)
        .reverse()
        .map((c) => c.status as Status),
    };
  });
  const buckets = new Map<string, number[]>();
  for (const c of checks.data ?? []) {
    if (c.latency_ms == null) continue;
    const key = new Date(
      Math.floor(Date.parse(c.checked_at) / 300000) * 300000,
    ).toISOString();
    buckets.set(key, [...(buckets.get(key) ?? []), c.latency_ms]);
  }
  return {
    mode: "live",
    services,
    incidents: (inc.data ?? []) as Incident[],
    lastRun:
      snap.data
        ?.map((s) => s.checked_at as string)
        .sort()
        .at(-1) ?? null,
    history: [...buckets]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, v]) => ({
        time,
        latency: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
      })),
  };
}
export async function liveHistory(id: string): Promise<HistoryPoint[]> {
  const { data, error } = await database()
    .from("checks")
    .select("checked_at,latency_ms,status")
    .eq("monitor_id", id)
    .gte("checked_at", new Date(Date.now() - 86400000).toISOString())
    .order("checked_at", { ascending: false })
    .limit(288);
  if (error) throw new Error(error.message);
  return (data ?? []).reverse() as HistoryPoint[];
}
