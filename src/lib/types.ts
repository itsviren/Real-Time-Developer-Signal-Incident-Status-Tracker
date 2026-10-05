export type Status =
  "operational" | "degraded" | "outage" | "maintenance" | "unknown";
export type Category =
  | "AI & Developer Tools"
  | "Cloud & Hosting"
  | "Data & Auth"
  | "Payments & Observability";
export interface Monitor {
  id: string;
  name: string;
  category: Category;
  url: string;
  type: "statuspage" | "instatus" | "incidentio" | "rss";
  color: string;
  mark: string;
}
export interface Incident {
  id: string;
  monitor_id: string;
  name: string;
  status: string;
  impact: string;
  url: string | null;
  updated_at: string;
  body: string;
}
export interface Check {
  monitor_id: string;
  status: Status;
  latency_ms: number | null;
  status_code: number;
  checked_at: string;
  error: string | null;
  incidents: Incident[];
}
export interface Service extends Monitor {
  status: Status;
  latency_ms: number | null;
  checked_at: string | null;
  error: string | null;
  history: Status[];
}
export interface HistoryPoint {
  checked_at: string;
  latency_ms: number | null;
  status: Status;
}
export interface DashboardData {
  mode: "preview" | "live";
  services: Service[];
  incidents: Incident[];
  history: { time: string; latency: number | null }[];
  lastRun: string | null;
}
export const STATUS_LABEL: Record<Status, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Major outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
};
