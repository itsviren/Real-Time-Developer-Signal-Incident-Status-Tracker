# Requirements

## Constraints

- Zero hosting and deployment spend; use free provider subdomains and plans.
- One Render Next.js web service for UI and backend, Supabase for PostgreSQL and Auth, Git/GitHub for version control.
- An external scheduler runs probes every five minutes. Nothing depends on a local computer staying on.
- No paid model calls, private provider API keys, or domain purchase required.

## Product behavior

- List 23 providers with search, category filters, status filters, and service details.
- Show official reported status separately from feed retrieval failures and feed response latency.
- Display recent incident titles and histories, timestamps, and data freshness.
- Measure feed fetch duration, not authenticated service API performance or global uptime.
- Treat malformed feeds, timeouts, and HTTP failures as unknown status; never infer a provider-wide outage from a failed fetch.
- Provide response-time charts, recent-check history, and honest empty/loading/error states.
- Protect scheduled probes with a server-side secret and a database lease. Use bounded concurrent requests and timeouts.
- Persist snapshots and incident summaries, keep 30 days of raw checks, and expose public data through RLS.
- Offer authenticated per-service Discord alert subscriptions; only send on known status transitions. Keep destinations private.
- Refresh the dashboard every 60 seconds, with Realtime notifications for snapshot changes when configured.

## Acceptance

The project builds without credentials and offers labelled preview data. With Supabase configured and migrations applied, probes persist real results and the dashboard reads them. Cron authorization, parsing, deduplication, and privacy boundaries have meaningful tests. Render and cron setup is documented and does not silently enable paid tiers.
