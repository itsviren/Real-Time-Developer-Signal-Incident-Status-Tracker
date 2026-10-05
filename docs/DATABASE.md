# Database

Apply `supabase/migrations/001_initial.sql` once in the Supabase SQL editor. It defines monitors, snapshots, checks, incidents, probe leases, alert subscriptions, and an alert outbox.

Public read policies expose only provider catalog, current status, raw checks, and provider incident summaries. Users may select, insert, update, and delete only their own subscriptions. The service role owns probe persistence and alert delivery. Internal leases and outbox are not public.

The `commit_probe` RPC writes a whole probe batch atomically while checking lease ownership. Raw checks older than 30 days and incidents older than 90 days are removed in bounded daily cleanup batches. No historical uptime promise is made without sufficient observations. The current implementation does not yet store daily rollups.

Realtime publishes snapshots only. This limits event fanout. Retention still requires monitoring actual database size: indexes and PostgreSQL overhead consume quota too.

Free Supabase currently includes a 500 MB database. Reduce retention or monitor count before the quota is reached; do not automatically upgrade.
