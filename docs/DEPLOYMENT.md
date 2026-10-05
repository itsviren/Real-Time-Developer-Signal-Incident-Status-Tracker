# Free deployment

## Supabase

1. Create a Free project. Apply `supabase/migrations/001_initial.sql`.
2. Obtain the project URL, browser anon/publishable key, and server service-role key. Never put the service key in a NEXT_PUBLIC variable.
3. Enable an Auth provider. For email/password, configure email confirmation and redirect URLs for localhost and your Render domain. Supabase's default email sender is rate-limited; OAuth can be configured instead for a larger audience.

## Render

Create one **Web Service**, connect this GitHub repository, select **Free**, and use Node 22.

- Build: `npm ci && npm run build`
- Start: `npm run start`
- Health check: `/api/health`
- Set `.env.example` variables in the dashboard. Public variables are needed at build time.
- Use the included `onrender.com` address. A custom domain is optional and not required.

`render.yaml` supplies the service blueprint with `plan: free`. It does not create any paid background worker or database.

## External cron

Use cron-job.org or an equivalent free external scheduler. Schedule every five minutes, POST `https://YOUR-SERVICE.onrender.com/api/probe`, header `Authorization: Bearer YOUR_CRON_SECRET`. Enable failure notifications. cron-job.org has a fixed 30-second request timeout, so the endpoint returns 202 after acquiring a lease; the batch runs after the response in the same Node process. Do not put the secret in the URL or publish it in GitHub.

A five-minute request performs probes and ordinarily prevents the 15-minute idle timeout. It does not prevent platform restarts or quota suspension. A missed run is visible through freshness indicators. After a cold start, retry a failed call rather than claiming a check succeeded.

Run the job once manually after setup. Confirm it returns 202 with `accepted: true`. After approximately a minute, confirm `probe_runs.status` is completed, the dashboard has fresh live checks, and Supabase contains 23 monitor rows. Acceptance alone does not establish completion. Alert subscriptions need these monitor rows before they can be saved. Then create a user, subscribe to a service, and test notification delivery with a controlled test fixture rather than declaring a real provider outage.

## Free limits and links

Verified 2026-10-05; recheck before deploying.

- Render: 750 shared free instance hours per workspace/month; one service needs up to 744 in a 31-day month. Other services share these hours. Bandwidth/build limits and outbound-traffic suspension can apply. https://render.com/docs/free
- Supabase: 500 MB database, 5 GB egress, 200 peak Realtime connections, 2 million Realtime messages/month; inactive free projects may pause after a week. https://supabase.com/pricing
- Cron: an external scheduler is another dependency. https://cron-job.org/en/

Do not select paid plans, buy domains, or enable automatic upgrades. No zero-downtime or lifetime-free guarantee is offered. 23 monitors generate 6,624 checks/day at a five-minute cadence.
