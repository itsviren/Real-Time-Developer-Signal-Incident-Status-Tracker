import "server-only";
import { database } from "./supabase-server";
import { validWebhook } from "./security";
import { MONITORS } from "./monitors";
import { STATUS_LABEL, type Status } from "./types";
export async function deliverAlerts() {
  const db = database();
  const { data, error } = await db.rpc("claim_alerts");
  if (error) throw new Error(error.message);
  let delivered = 0,
    failed = 0;
  for (const item of data ?? []) {
    try {
      if (!validWebhook(item.destination))
        throw new Error("Invalid Discord destination");
      const name =
        MONITORS.find((m) => m.id === item.monitor_id)?.name ?? item.monitor_id;
      const response = await fetch(item.destination, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `SignalDesk · ${name}: ${STATUS_LABEL[item.before_status as Status]} → ${STATUS_LABEL[item.after_status as Status]}. Provider-reported status changed.`,
          allowed_mentions: { parse: [] },
        }),
      });
      if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
      const update = await db
        .from("alert_outbox")
        .update({
          delivered_at: new Date().toISOString(),
          last_error: null,
          claimed_until: null,
        })
        .eq("id", item.id);
      if (update.error) throw new Error("Delivery acknowledgement failed");
      delivered++;
    } catch (e) {
      failed++;
      await db
        .from("alert_outbox")
        .update({
          last_error: e instanceof Error ? e.message : "Delivery failed",
          claimed_until: null,
        })
        .eq("id", item.id);
    }
  }
  return { delivered, failed };
}
