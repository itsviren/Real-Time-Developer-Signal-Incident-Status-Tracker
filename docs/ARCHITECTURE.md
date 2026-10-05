# Architecture

## Request lifetime

cron-job.org closes requests after 30 seconds. The handler acquires a lease and returns 202, then Next.js `after` runs the job in Render's self-hosted Node process. This is not a durable external queue. The `probe_runs` ledger and freshness expose incomplete runs; a process restart may interrupt work and the next scheduled run recovers after lease expiry. Native Node hosting supports `after`: https://nextjs.org/docs/app/api-reference/functions/after

```text
GitHub source → Render Next.js web service
External cron → POST /api/probe → bounded provider feed fetches
                              → atomic Supabase persistence
                              → transition alert delivery
Browser → /api/dashboard + /api/history → public Supabase data
Browser → Supabase Auth + RLS → private alert subscriptions
```

## Boundaries

App Router renders the shell; client components handle filters, charts, details, Auth, and Realtime. The service-role database client remains server-only. The browser uses the public publishable/anon key under RLS.

Service definitions are a fixed allowlist. Feed adapters support Atlassian Statuspage, Instatus, incident.io, and RSS/Atom. incident.io ongoing incidents map conservatively to degraded, with active maintenance separate. RSS activity without an explicit reliable resolution state is informational rather than a global outage assertion. Unsupported payloads become unknown.

The cron endpoint acquires a PostgreSQL lease before probing. A token ties commit and release to its owner. A transaction inserts the raw checks, updates snapshots and incidents, and records status transitions in an alert outbox. Delivery claims prevent concurrent sends; failures are retried with bounded attempts. An initial baseline is not a transition alert. Transitions compare the last known report, so temporary unknown feed results do not erase the recovery baseline.

## Decisions

- Keep the frontend and API in one Render process to fit shared free instance hours.
- Use external cron rather than an in-process timer, which stops when the app sleeps.
- Persist real data only when configured. No synthetic fallback on a live database error.
- Public feed latency excludes payload parsing, measured through body download. It is not API inference latency.
- Browser polling is the baseline; Realtime subscribes only to snapshots, not every raw check.
- Email alerts are deferred until a verified sending domain and free quota can be supplied. Discord works without buying a domain.
