"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Globe2,
  LayoutGrid,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { CATEGORIES } from "@/lib/monitors";
import { browserDatabase } from "@/lib/supabase-browser";
import {
  STATUS_LABEL,
  type DashboardData,
  type HistoryPoint,
  type Service,
  type Status,
} from "@/lib/types";
import { LatencyChart } from "./chart";
import { AlertsPanel } from "./alerts-panel";
import { Button } from "./ui/button";
import { useDialog } from "@/hooks/use-dialog";
function elapsed(iso: string | null, now: number) {
  if (!iso) return "Not checked";
  const mins = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  return mins < 1
    ? "just now"
    : mins < 60
      ? `${mins}m ago`
      : `${Math.floor(mins / 60)}h ago`;
}
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge ${status}`}>
      <i />
      {STATUS_LABEL[status]}
    </span>
  );
}
function ServiceMark({ service }: { service: Service }) {
  return (
    <span
      className="service-mark"
      style={{ color: service.color, background: `${service.color}12` }}
    >
      {service.mark}
    </span>
  );
}
export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All services"),
    [status, setStatus] = useState("all"),
    [tab, setTab] = useState("overview"),
    [selected, setSelected] = useState<Service | null>(null),
    [alerts, setAlerts] = useState(false),
    [now, setNow] = useState(0);
  const running = useRef(false),
    searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !selected &&
        !alerts
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selected, alerts]);
  const load = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      if (!r.ok)
        throw new Error(
          "Could not load status data. Your last view may be out of date.",
        );
      setData(await r.json());
      setError("");
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      setNow(Date.now());
      void load();
    }, 60000);
    const db = browserDatabase();
    const channel = db
      ?.channel("public-snapshots")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "snapshots" },
        () => void load(),
      )
      .subscribe();
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      if (db && channel) void db.removeChannel(channel);
    };
  }, [load]);
  const services = data?.services ?? [],
    operational = services.filter((s) => s.status === "operational").length,
    affected = services.filter((s) =>
      ["degraded", "outage", "maintenance"].includes(s.status),
    ).length,
    unknown = services.filter((s) => s.status === "unknown").length;
  const activeIncidents = (data?.incidents ?? []).filter(
    (i) => !["resolved", "completed"].includes(i.status),
  );
  const filtered = services.filter(
    (s) =>
      (category === "All services" || s.category === category) &&
      (status === "all" || s.status === status) &&
      s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const stale =
    data?.mode === "live" &&
    (!data.lastRun || now - Date.parse(data.lastRun) > 15 * 60000);
  const latencies = services
    .map((s) => s.latency_ms)
    .filter((v): v is number => v !== null);
  const average = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Activity size={21} />
          </span>
          SignalDesk<span className="brand-dot">.</span>
        </Link>
        <div className="workspace">
          <span className="workspace-avatar">V</span>
          <div>
            <strong>Developer workspace</strong>
            <span>Personal project</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          <button
            className={tab === "overview" ? "active" : ""}
            onClick={() => setTab("overview")}
          >
            <LayoutGrid size={17} />
            Overview
          </button>
          <button
            className={tab === "incidents" ? "active" : ""}
            onClick={() => setTab("incidents")}
          >
            <Radio size={17} />
            Incidents<span className="nav-count">{activeIncidents.length}</span>
          </button>
          <button onClick={() => setAlerts(true)}>
            <Bell size={17} />
            Alert subscriptions
          </button>
        </nav>
        <span className="nav-label category-label">SERVICE GROUPS</span>
        <div className="category-nav">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              className={category === c ? "chosen" : ""}
              onClick={() => {
                setCategory(category === c ? "All services" : c);
                setTab("overview");
              }}
            >
              <span className={`category-dot dot-${i}`} />
              {c}
              <span>
                {services.filter((s) => s.category === c).length ||
                  [7, 6, 5, 5][i]}
              </span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="collection-note">
            <ShieldCheck size={18} />
            <strong>Public signals. Clear context.</strong>
            <p>Official provider reports, collected in one place.</p>
          </div>
          <a
            href="https://github.com/itsviren/Real-Time-Developer-Signal-Incident-Status-Tracker"
            target="_blank"
            rel="noreferrer"
          >
            <Terminal size={16} />
            View source
            <ArrowUpRight size={14} />
          </a>
          <span className="version">SignalDesk / v0.1</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>{tab === "overview" ? "Overview" : "Incidents"}</span>
          </div>
          <div className="topbar-right">
            <span className="small muted desktop-only">
              Checks every 5 minutes
            </span>
            <a
              className="source-link"
              href="https://github.com/itsviren/Real-Time-Developer-Signal-Incident-Status-Tracker"
              aria-label="GitHub repository"
              target="_blank"
              rel="noreferrer"
            >
              <Terminal size={17} />
            </a>
            <span className="user-avatar">V</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-signal" />
                DEVELOPER INFRASTRUCTURE
              </div>
              <h1>
                {tab === "overview"
                  ? "A pulse on your developer stack."
                  : "Every incident. One timeline."}
              </h1>
              <p>
                Track service health, follow incidents, and stay ahead of
                disruptions.
              </p>
            </div>
            <Button variant="outline" onClick={() => setAlerts(true)}>
              <Bell size={16} />
              Manage alerts
            </Button>
          </div>
          {data?.mode === "preview" && (
            <div className="preview-banner">
              <Zap size={16} />
              <span>
                <strong>You’re exploring a preview.</strong> Statuses and charts
                are illustrative. Connect Supabase to start collecting real
                signals.
              </span>
              <span className="preview-tag">PREVIEW</span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <Button variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          )}
          {stale && (
            <div className="error-banner" role="status">
              Checks are stale or haven’t started. Last collected:{" "}
              {elapsed(data?.lastRun ?? null, now)}. Check your scheduler.
            </div>
          )}
          <section className="summary-grid" aria-label="Status summary">
            <Summary
              icon={<Globe2 size={17} />}
              title="Monitored services"
              value={data ? String(services.length) : "—"}
              foot="Across 4 service groups"
            />
            <Summary
              icon={<Check size={17} />}
              title="Operational"
              value={data ? String(operational) : "—"}
              foot={
                unknown
                  ? `${unknown} unknown · ${affected} affected`
                  : "Based on provider reports"
              }
              accent
            />
            <Summary
              icon={<Radio size={17} />}
              title="Active reports"
              value={data ? String(activeIncidents.length) : "—"}
              foot="Includes maintenance & RSS posts"
            />
            <Summary
              icon={<Zap size={17} />}
              title="Avg. feed response"
              value={average === null ? "—" : String(average)}
              suffix="ms"
              foot="Status feed latency, not API latency"
            />
          </section>
          <div className="content-tabs">
            <div>
              <button
                className={tab === "overview" ? "selected" : ""}
                onClick={() => setTab("overview")}
              >
                Service overview
              </button>
              <button
                className={tab === "incidents" ? "selected" : ""}
                onClick={() => setTab("incidents")}
              >
                Incident timeline<span>{activeIncidents.length}</span>
              </button>
            </div>
            <span className={`collection-status ${stale ? "stale" : ""}`}>
              <i />
              {data?.mode === "preview"
                ? "Preview data"
                : data?.lastRun
                  ? `Collected ${elapsed(data.lastRun, now)}`
                  : "Awaiting first check"}
              <button
                onClick={() => void load()}
                disabled={busy}
                aria-label="Refresh dashboard"
              >
                <RefreshCw size={13} className={busy ? "spin" : ""} />
              </button>
            </span>
          </div>
          {tab === "overview" ? (
            <>
              <section className="services-panel">
                <div className="panel-toolbar">
                  <div className="search">
                    <Search size={16} />
                    <input
                      ref={searchRef}
                      aria-label="Search services"
                      placeholder="Search services…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <kbd>/</kbd>
                  </div>
                  <div className="filters">
                    <select
                      aria-label="Filter category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option>All services</option>
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="service-table">
                  <div className="table-heading">
                    <span>SERVICE</span>
                    <span>STATUS</span>
                    <span>RECENT CHECKS</span>
                    <span>FEED RESPONSE</span>
                    <span />
                  </div>
                  {!data && !error ? (
                    <div className="loading-state">
                      <RefreshCw size={20} className="spin" />
                      Loading service signals…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="loading-state">
                      No services match your filters.
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearch("");
                          setCategory("All services");
                          setStatus("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    filtered.map((s) => (
                      <button
                        key={s.id}
                        className="service-row"
                        onClick={() => setSelected(s)}
                        aria-label={`View ${s.name} details`}
                      >
                        <span className="service-name">
                          <ServiceMark service={s} />
                          <span>
                            <strong>{s.name}</strong>
                            <small>{s.category}</small>
                          </span>
                        </span>
                        <StatusBadge status={s.status} />
                        <span
                          className="history-bars"
                          aria-label={`${s.history.length} recent checks`}
                        >
                          {s.history.length ? (
                            s.history.map((v, i) => (
                              <i
                                key={i}
                                className={v}
                                title={STATUS_LABEL[v]}
                              />
                            ))
                          ) : (
                            <span className="muted small">No checks yet</span>
                          )}
                        </span>
                        <span className="latency">
                          {s.latency_ms === null ? (
                            "—"
                          ) : (
                            <>
                              {s.latency_ms}
                              <small> ms</small>
                            </>
                          )}
                          <small className="checked-time">
                            {elapsed(s.checked_at, now)}
                          </small>
                        </span>
                        <ChevronRight size={15} className="row-arrow" />
                      </button>
                    ))
                  )}
                </div>
                <div className="table-footer">
                  <span>
                    {filtered.length} of {services.length} services
                  </span>
                  <span>
                    <i className="legend-dot" />
                    Operational <i className="legend-dot degraded" />
                    Degraded <i className="legend-dot unknown" />
                    Unknown
                  </span>
                </div>
              </section>
              <div className="bottom-grid">
                <section className="panel response-panel">
                  <div className="panel-title">
                    <div>
                      <h2>Feed response time</h2>
                      <p>Average across collected provider feeds</p>
                    </div>
                    <span className="chip">Recent checks</span>
                  </div>
                  <LatencyChart points={data?.history ?? []} />
                  <div className="chart-caption">
                    <ArrowDownLeft size={13} />
                    Lower is faster
                    <span>Milliseconds · feed retrieval only</span>
                  </div>
                </section>
                <section className="panel incident-panel">
                  <div className="panel-title">
                    <div>
                      <h2>Latest reports</h2>
                      <p>Updates from official status feeds</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setTab("incidents")}
                    >
                      View all <ArrowUpRight size={13} />
                    </button>
                  </div>
                  <IncidentList data={data} limit={3} />
                </section>
              </div>
            </>
          ) : (
            <section className="panel timeline-panel">
              <div className="panel-title">
                <div>
                  <h2>Provider incident timeline</h2>
                  <p>
                    Reported events may affect specific components or regions.
                  </p>
                </div>
                <span className="chip">
                  {data?.incidents.length ?? 0} reports
                </span>
              </div>
              <IncidentList data={data} />
            </section>
          )}
          <footer className="footer">
            <span>
              <Activity size={14} />
              SignalDesk <span className="footer-divider">/</span> Clarity for
              your developer stack.
            </span>
            <span>
              <Clock3 size={13} />
              5-minute collection · Sources may report with a delay
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <ServiceDetail
          service={services.find((s) => s.id === selected.id) ?? selected}
          now={now}
          preview={data?.mode === "preview"}
          onClose={() => setSelected(null)}
        />
      )}{" "}
      {alerts && <AlertsPanel onClose={() => setAlerts(false)} />}
    </div>
  );
}
function Summary({
  icon,
  title,
  value,
  foot,
  suffix,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  foot: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="summary-card">
      <div className="summary-label">
        {title}
        <span>{icon}</span>
      </div>
      <div className={`summary-value ${accent ? "green" : ""}`}>
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
      <p>
        {accent && <i className="tiny-signal" />}
        {foot}
      </p>
    </div>
  );
}
function IncidentList({
  data,
  limit,
}: {
  data: DashboardData | null;
  limit?: number;
}) {
  const incidents = limit ? data?.incidents.slice(0, limit) : data?.incidents;
  return (
    <div className="incident-list">
      {!incidents?.length ? (
        <div className="incident-empty">
          <ShieldCheck size={25} />
          <strong>
            {data ? "No reports collected" : "Waiting for reports"}
          </strong>
          <p>Provider incident updates will appear here.</p>
        </div>
      ) : (
        incidents.map((i) => (
          <article className="incident-item" key={`${i.monitor_id}-${i.id}`}>
            <span className={`incident-dot ${i.impact}`} />
            <div>
              <div className="incident-meta">
                <strong>
                  {data?.services.find((s) => s.id === i.monitor_id)?.name ??
                    i.monitor_id}
                </strong>
                <span>
                  {new Date(i.updated_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <h3>{i.name}</h3>
              <div className="incident-bottom">
                <span>{i.status.replaceAll("_", " ")}</span>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noreferrer">
                    Official report
                    <ExternalLink size={12} />
                  </a>
                )}
                {data?.mode === "preview" && <span>Illustrative</span>}
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
function ServiceDetail({
  service,
  now,
  preview,
  onClose,
}: {
  service: Service;
  now: number;
  preview: boolean;
  onClose: () => void;
}) {
  const dialogRef = useDialog(onClose);
  const [history, setHistory] = useState<HistoryPoint[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/history?monitor=${encodeURIComponent(service.id)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load response history");
        return r.json();
      })
      .then((d) => setHistory(d.history))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [service.id]);
  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-title"
      >
        <div className="modal-heading">
          <div className="service-name">
            <ServiceMark service={service} />
            <div>
              <span className="eyebrow">{service.category}</span>
              <h2 id="service-title">{service.name}</h2>
            </div>
          </div>
          <Button
            autoFocus
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close service details"
          >
            <X size={20} />
          </Button>
        </div>
        <div className="detail-status">
          <StatusBadge status={service.status} />
          <span className="muted small">
            Collected {elapsed(service.checked_at, now)}
          </span>
        </div>
        {preview && (
          <p className="preview-banner">
            Illustrative preview. These are not live provider measurements.
          </p>
        )}
        {service.error && <p className="error-banner">{service.error}</p>}
        <h3 className="detail-chart-title">
          Status-feed response time <span>Last 24 hours · ms</span>
        </h3>
        {error ? (
          <p role="alert" className="error-banner">
            {error}
          </p>
        ) : (
          <LatencyChart
            points={history.map((p) => ({
              time: p.checked_at,
              latency: p.latency_ms,
            }))}
          />
        )}
        <p className="muted small">
          Measures this collector’s retrieval of the provider’s public status
          feed. It does not measure the provider’s actual API latency or global
          uptime.
        </p>
        <Button asChild variant="outline">
          <a href={service.url} target="_blank" rel="noreferrer">
            View official source
            <ExternalLink size={14} />
          </a>
        </Button>
      </section>
    </div>
  );
}
