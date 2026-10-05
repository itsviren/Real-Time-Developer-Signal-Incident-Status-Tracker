# Roadmap

## Initial implementation

- [x] Searchable status dashboard and service details
- [x] Preview mode and explicit data freshness
- [x] Provider adapters and protected scheduled runner
- [x] Transactional storage, lease, retention, and alert outbox
- [x] Authenticated Discord subscription implementation (live-account check pending)
- [x] Snapshot Realtime and polling implementation (live-account check pending)
- [x] Production build, automated tests, browser checks, and deployment configuration

## Launch requirements

- [ ] Create free Supabase project and apply migration
- [ ] Configure Auth and verify RLS with two users
- [ ] Deploy one free Render service
- [ ] Configure external cron and verify persisted runs
- [x] Validate actual provider endpoint formats
- [ ] Validate live alert delivery
- [ ] Watch quotas and database size

## Later

Daily rollups, incident component filters, optional OAuth, verified-domain email alerts, optional response-spike alerts, synthetic checks against explicitly approved public endpoints, alert cooldown preferences, and stronger independent monitoring. These are not claimed as completed features.
