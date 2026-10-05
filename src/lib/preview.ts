import { MONITORS } from "./monitors";
import type { DashboardData, HistoryPoint, Status } from "./types";
export function previewHistory(index = 0): HistoryPoint[] {
  const now = Date.now();
  return Array.from({ length: 48 }, (_, i) => ({
    checked_at: new Date(now - (47 - i) * 30 * 60000).toISOString(),
    latency_ms: Math.round(
      170 + index * 13 + Math.sin(i * 0.43) * 45 + Math.cos(i * 0.9) * 22,
    ),
    status: "operational",
  }));
}
export function previewDashboard(): DashboardData {
  const now = new Date().toISOString();
  return {
    mode: "preview",
    lastRun: now,
    services: MONITORS.map((m, index) => ({
      ...m,
      status:
        index === 2
          ? "degraded"
          : index === 7
            ? "maintenance"
            : index === 10
              ? "unknown"
              : "operational",
      latency_ms: index === 10 ? null : 180 + index * 17,
      checked_at: now,
      error:
        index === 10
          ? "RSS feed does not establish current global health"
          : null,
      history: Array.from({ length: 48 }, (_, i): Status =>
        index === 2 && i > 40
          ? "degraded"
          : index === 7 && i > 43
            ? "maintenance"
            : index === 10
              ? "unknown"
              : "operational",
      ),
    })),
    incidents: [
      {
        id: "preview-1",
        monitor_id: "anthropic",
        name: "Elevated error rates on the API",
        status: "investigating",
        impact: "minor",
        url: null,
        updated_at: now,
        body: "Illustrative incident for previewing the dashboard. This is not a current provider incident.",
      },
      {
        id: "preview-2",
        monitor_id: "cloudflare",
        name: "Scheduled network maintenance",
        status: "in_progress",
        impact: "maintenance",
        url: null,
        updated_at: now,
        body: "Illustrative scheduled maintenance. Connect Supabase to display actual reports.",
      },
    ],
    history: previewHistory().map((p) => ({
      time: p.checked_at,
      latency: p.latency_ms,
    })),
  };
}
