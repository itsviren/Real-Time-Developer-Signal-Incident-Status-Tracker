# Operations

Check dashboard freshness and external cron failures. Investigate missing probes after 15 minutes. Unknown means feed retrieval/parsing failed, not confirmed provider outage. Compare official source links before interpreting incidents.

202 means the job was accepted, not that persistence succeeded. Inspect the private `probe_runs` table for completed/failed runs and use dashboard freshness to detect missing collection. On a background database write failure, the run records failure. A crashed runner's lease expires after two minutes; the next accepted run marks abandoned runs failed. Failed alert sends retry on later runs, up to five attempts; inspect the private outbox for errors. Delivery is at least once, not exactly once.

Retention removes limited batches once daily and may take multiple days to catch up after an extended outage. Monitor table sizes, Realtime usage, egress, and Render service hours. Export data manually before risky migrations; do not assume the free plan provides full automatic backups.

Rotate leaked cron keys and webhook URLs immediately. Rotate service-role keys through Supabase. Update Render env values and scheduler headers together. Run validation before dependency updates; commit the lockfile.
