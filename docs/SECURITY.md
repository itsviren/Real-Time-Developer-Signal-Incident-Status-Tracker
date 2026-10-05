# Security

- Ignore all local environment files except `.env.example`; never commit real tokens.
- Service-role key and cron secret remain server-only.
- Constant-time comparison checks the cron authorization value; require a long random secret.
- Supabase RLS protects user-owned subscriptions with USING and WITH CHECK policies.
- Probe targets come from a fixed catalog. Users cannot submit arbitrary probe destinations.
- Discord webhook validation allows only exact Discord hosts and webhook paths, disallows credentials, fragments, and ports, and blocks redirects. Public API responses never include webhook secrets.
- Cross-user subscription access must be verified using two test users before public launch.
- Bound requests, response payload size, query sizes, and probe concurrency.
- Escape provider text through React; never render provider HTML.
- Lease ownership and transactional writes prevent overlapping batches. Webhooks have at-least-once delivery: a process crash after a successful send can still cause a retry.

Report vulnerabilities privately to the repository owner, not with secrets in public issues.
