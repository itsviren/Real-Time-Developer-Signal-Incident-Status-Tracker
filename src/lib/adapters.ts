import { XMLParser } from "fast-xml-parser";
import type { Incident, Monitor, Status } from "./types";
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export function safeUrl(v: unknown): string | null {
  try {
    const u = new URL(str(v));
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function parseFeed(
  m: Monitor,
  text: string,
  now = new Date(),
): { status: Status; incidents: Incident[] } {
  if (m.type === "rss") return parseRss(m, text, now);
  const payload = obj(JSON.parse(text));
  if (m.type === "incidentio") {
    if (
      !Array.isArray(payload.ongoing_incidents) ||
      !Array.isArray(payload.in_progress_maintenances)
    )
      return { status: "unknown", incidents: [] };
    const active = list(payload.ongoing_incidents),
      maintenance = list(payload.in_progress_maintenances);
    const incidents = [...active, ...maintenance]
      .slice(0, 30)
      .map((v) => {
        const i = obj(v),
          sev = obj(i.severity),
          stamp = str(i.updated_at) || str(i.started_at);
        return {
          id: str(i.id),
          monitor_id: m.id,
          name: str(i.name),
          status: str(obj(i.current_incident_status).name) || "reported",
          impact: str(sev.name) || "minor",
          url: safeUrl(i.url),
          updated_at: Number.isFinite(Date.parse(stamp))
            ? new Date(stamp).toISOString()
            : now.toISOString(),
          body: "",
        };
      })
      .filter((i) => i.id && i.name);
    return {
      status: active.length
        ? "degraded"
        : maintenance.length
          ? "maintenance"
          : "operational",
      incidents,
    };
  }
  let status: Status = "unknown";
  if (m.type === "statuspage") {
    const indicator = str(obj(payload.status).indicator);
    status =
      (
        {
          none: "operational",
          minor: "degraded",
          major: "outage",
          critical: "outage",
          maintenance: "maintenance",
        } as Record<string, Status>
      )[indicator] ?? "unknown";
  } else {
    const s = str(obj(payload.page).status).toUpperCase();
    status =
      (
        {
          UP: "operational",
          HASISSUES: "degraded",
          UNDERMAINTENANCE: "maintenance",
          DOWN: "outage",
        } as Record<string, Status>
      )[s] ?? "unknown";
  }
  const maintenance = list(payload.scheduled_maintenances).filter((v) =>
    ["in_progress", "verifying"].includes(str(obj(v).status)),
  );
  if (status === "operational" && maintenance.length) status = "maintenance";
  const incidents = [...list(payload.incidents), ...maintenance]
    .slice(0, 30)
    .map((v) => {
      const i = obj(v),
        update = obj(list(i.incident_updates)[0]);
      const stamp = str(i.updated_at) || str(i.updatedAt);
      return {
        id: str(i.id),
        monitor_id: m.id,
        name: str(i.name),
        status: str(i.status),
        impact: str(i.impact) || "none",
        url: safeUrl(i.shortlink),
        updated_at: Number.isFinite(Date.parse(stamp))
          ? new Date(stamp).toISOString()
          : now.toISOString(),
        body: (str(update.body) || str(i.message)).slice(0, 1200),
      };
    })
    .filter((i) => i.id && i.name);
  return { status, incidents };
}
function parseRss(
  m: Monitor,
  text: string,
  now: Date,
): { status: Status; incidents: Incident[] } {
  if (!text.includes("<rss") && !text.includes("<feed"))
    throw new Error("Unsupported feed format");
  const p = obj(
    new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(
      text,
    ),
  );
  const channel = obj(obj(p.rss).channel);
  const items = channel.item === undefined ? obj(p.feed).entry : channel.item;
  const entries = Array.isArray(items) ? items : items ? [items] : [];
  const incidents: Incident[] = entries
    .map((v) => {
      const i = obj(v),
        date = str(i.pubDate) || str(i.updated),
        title = str(i.title),
        link = safeUrl(i.link) || safeUrl(obj(i.link)["@_href"]),
        description = str(i.description) || str(i.summary) || str(i.content);
      return {
        id:
          str(i.guid) ||
          str(obj(i.guid)["#text"]) ||
          str(i.id) ||
          link ||
          title,
        monitor_id: m.id,
        name: title,
        status:
          /resolved|restored|completed/i.test(title) ||
          /status:\s*resolved/i.test(description.replace(/<[^>]*>/g, ""))
            ? "resolved"
            : "reported",
        impact: "informational",
        url: link,
        updated_at: Number.isFinite(Date.parse(date))
          ? new Date(date).toISOString()
          : "",
        body: description.replace(/<[^>]*>/g, "").slice(0, 1200),
      };
    })
    .filter(
      (i) =>
        i.id &&
        i.name &&
        i.updated_at &&
        now.getTime() - Date.parse(i.updated_at) < 86400000 &&
        Date.parse(i.updated_at) <= now.getTime(),
    );
  // RSS posts do not establish current global health, even when the feed is empty.
  return { status: "unknown", incidents: incidents.slice(0, 30) };
}
