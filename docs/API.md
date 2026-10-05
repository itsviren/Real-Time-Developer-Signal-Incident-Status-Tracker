# API

## GET /api/health

Public process health and whether database configuration exists. Does not reveal credentials or guarantee provider probes are fresh.

## GET /api/dashboard

Returns `mode` (`preview` or `live`), service snapshots, incidents, aggregate history, and last successful run timestamp. Preview is only used when database configuration is absent. Database errors return 503, not fake live data. Cache is short and public; personal destinations never enter the payload.

## GET /api/history?monitor=github

Returns up to 288 recent checks for a known monitor from the last 24 hours. Unknown IDs receive 400. Preview returns labelled illustrative data.

## POST /api/probe

Requires `Authorization: Bearer <CRON_SECRET>`; secret must contain at least 32 characters. Acquires a database lease, records a run, and returns 202 with an accepted run ID. Next.js `after` performs probes and transactional persistence in the same Render Node process, then drains the alert outbox and performs bounded daily retention cleanup. 202 means accepted, not completed. Inspect private `probe_runs` and dashboard freshness for completion. 401 invalid credentials, 503 missing config or scheduling failure, 409 overlapping run. No URL query secret is supported. A process restart may interrupt accepted work; the lease expires and a subsequent cron recovers.

## Alerts

The browser calls Supabase directly with its authenticated session. RLS isolates subscription rows. Discord destinations must be canonical HTTPS Discord webhook URLs. The worker disables redirects and validates destinations again before outbound requests.
