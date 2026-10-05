# Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Tests cover adapter semantics, unknown malformed responses, stale/resolved RSS handling, Discord URL validation, auth comparison, and known transition rules. PGlite runs the migration against a local PostgreSQL engine to check leases, transactional writes, outbox claims, and RLS. This does not replace a live Supabase integration check. Mock HTTP in automated tests; live endpoint checks are a separate smoke check and provider failures are expected to become unknown.

`npm run test:e2e` exercises the unconfigured preview in Playwright, including filters, dialogs, mobile overflow, and API responses. It uses installed Chrome on Windows when present; otherwise install a Playwright Chromium browser with `node node_modules/playwright/cli.js install chromium`. Screenshot artifacts are stored under docs/screenshots. Run this preview test without real Supabase environment variables.

Manual checks: search/category/status filters; detail chart; preview label; mobile layout; failure retry; keyboard focus; signin/signout; subscription create/delete. With Supabase, verify the migration and RPCs, lease conflicts, live batch persistence, retention, transition alerts, and RLS isolation with two users. External account-dependent checks remain unverified until credentials exist.
