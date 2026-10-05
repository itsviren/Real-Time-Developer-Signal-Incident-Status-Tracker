import { parseFeed } from "./adapters";
import type { Check, Monitor } from "./types";
export async function probe(
  m: Monitor,
  fetcher: typeof fetch = fetch,
): Promise<Check> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const base = { monitor_id: m.id, checked_at: new Date().toISOString() };
  let code = 0;
  try {
    const response = await fetcher(m.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "SignalDesk/0.1 (+public status monitoring)",
        Accept: "application/json, application/rss+xml, application/xml",
      },
      cache: "no-store",
    });
    code = response.status;
    if (!response.ok) throw new Error(`Feed returned HTTP ${code}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) {
        await reader.cancel();
        throw new Error("Feed exceeds 1 MB limit");
      }
      chunks.push(value);
    }
    const latency_ms = Math.round(performance.now() - start);
    const text = Buffer.concat(chunks).toString("utf8");
    const parsed = parseFeed(m, text);
    return {
      ...base,
      latency_ms,
      status_code: code,
      error:
        parsed.status === "unknown"
          ? m.type === "rss"
            ? "RSS feed does not establish current global health"
            : "Unrecognized provider status"
          : null,
      ...parsed,
    };
  } catch (e) {
    return {
      ...base,
      status: "unknown",
      latency_ms: null,
      status_code: code,
      error: e instanceof Error ? e.message : "Feed unavailable",
      incidents: [],
    };
  } finally {
    clearTimeout(timer);
  }
}
export async function probeAll(monitors: Monitor[]): Promise<Check[]> {
  const result: Check[] = [];
  for (let index = 0; index < monitors.length; index += 6) {
    result.push(
      ...(await Promise.all(
        monitors.slice(index, index + 6).map((m) => probe(m)),
      )),
    );
  }
  return result;
}
