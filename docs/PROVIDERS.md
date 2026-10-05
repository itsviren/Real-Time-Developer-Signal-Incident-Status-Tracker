# Provider sources

The 23-service catalog is in `src/lib/monitors.ts`. `npm run smoke` checks the current endpoints without writing data or sending alerts. Availability and formats can change.

The original plan assumed all providers exposed Atlassian Statuspage JSON. Live inspection on 2026-10-05 found these exceptions:

- Linear: `https://linearstatus.com/api/v1/summary` uses incident.io; the old JSON URL returns HTML.
- Resend: `https://resend-status.com/api/v1/summary` uses incident.io; the old JSON URL returns HTML.
- Docker: `https://www.dockerstatus.com/api/v2/summary.json` uses Statuspage rather than the proposed Instatus endpoint.
- Stripe: `https://status.stripe.com/current/atom.xml` is advertised by its official status page. Its older current/full JSON returned a stale timestamp during inspection, so we avoid presenting it as current health.
- AWS: `https://status.aws.amazon.com/rss/all.rss` returns RSS; the newer-looking health path returns HTML. AWS warns RSS may not contain all health information.

RSS/Atom sources collect reports and feed latency, but current global health remains unknown. This is intentional, not an outage. Only feed items dated within the past 24 hours are ingested, and feed completeness is not guaranteed. Statuspage summary indicators also aggregate components; a degraded provider does not mean every API or region is affected.

Sources: https://linearstatus.com/ · https://resend-status.com/ · https://status.stripe.com/ · https://docs.aws.amazon.com/health/latest/ug/aws-health-dashboard-status.html
