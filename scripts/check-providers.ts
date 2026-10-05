import { MONITORS } from "../src/lib/monitors";
import { probeAll } from "../src/lib/probe";
async function main() {
  const checks = await probeAll(MONITORS);
  for (const c of checks)
    console.log(
      `${c.monitor_id.padEnd(14)} ${String(c.status_code).padEnd(4)} ${c.status.padEnd(12)} ${c.latency_ms ?? "—"}ms ${c.error ?? ""}`,
    );
}
void main();
