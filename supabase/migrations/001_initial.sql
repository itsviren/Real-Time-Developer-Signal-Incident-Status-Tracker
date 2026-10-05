-- Apply once to a new Supabase project. All probe RPCs are service-role only.
create table public.monitors (id text primary key, name text not null, category text not null, endpoint_url text not null, probe_type text not null);
create table public.snapshots (monitor_id text primary key references public.monitors(id), status text not null check (status in ('operational','degraded','outage','maintenance','unknown')), latency_ms integer, status_code integer not null, checked_at timestamptz not null, error text);
create table public.checks (id bigint generated always as identity primary key, monitor_id text not null references public.monitors(id), status text not null, latency_ms integer, status_code integer not null, checked_at timestamptz not null, error text);
create index checks_monitor_time on public.checks(monitor_id,checked_at desc);
create index checks_time on public.checks(checked_at);
create table public.incidents (id text not null, monitor_id text not null references public.monitors(id), name text not null, status text not null, impact text not null, url text, updated_at timestamptz not null, body text not null default '', primary key(monitor_id,id));
create index incidents_time on public.incidents(updated_at desc);
create table public.alert_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, monitor_id text not null references public.monitors(id), destination text not null check (destination ~ '^https://(discord\.com|discordapp\.com)/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'), created_at timestamptz not null default now(), unique(user_id,monitor_id));
create table public.alert_outbox (id bigint generated always as identity primary key, subscription_id uuid references public.alert_subscriptions(id) on delete cascade, monitor_id text not null, before_status text not null, after_status text not null, created_at timestamptz not null default now(), delivered_at timestamptz, attempts integer not null default 0, claimed_until timestamptz, last_error text);
create index outbox_pending on public.alert_outbox(created_at) where delivered_at is null;
create table public.probe_leases (name text primary key, token uuid not null, expires_at timestamptz not null);
create table public.maintenance_state (name text primary key, performed_at timestamptz not null);
create table public.probe_runs (id uuid primary key, started_at timestamptz not null default now(), completed_at timestamptz, status text not null check(status in ('running','completed','failed')), check_count integer, error text);

alter table public.monitors enable row level security;
alter table public.snapshots enable row level security;
alter table public.checks enable row level security;
alter table public.incidents enable row level security;
alter table public.alert_subscriptions enable row level security;
alter table public.alert_outbox enable row level security;
alter table public.probe_leases enable row level security;
alter table public.maintenance_state enable row level security;
alter table public.probe_runs enable row level security;
create policy "Public monitor read" on public.monitors for select to anon, authenticated using (true);
create policy "Public snapshot read" on public.snapshots for select to anon, authenticated using (true);
create policy "Public check read" on public.checks for select to anon, authenticated using (true);
create policy "Public incident read" on public.incidents for select to anon, authenticated using (true);
create policy "Own subscriptions" on public.alert_subscriptions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select on public.monitors, public.snapshots, public.checks, public.incidents to anon, authenticated;
grant select,insert,update,delete on public.alert_subscriptions to authenticated;
revoke all on public.alert_outbox,public.probe_leases,public.maintenance_state,public.probe_runs from anon, authenticated;
revoke insert,update,delete on public.monitors,public.snapshots,public.checks,public.incidents from anon, authenticated;
alter publication supabase_realtime add table public.snapshots;

create function public.acquire_probe(p_token uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare acquired boolean;
begin
 insert into probe_leases values ('probe',p_token,now()+interval '2 minutes') on conflict(name) do update set token=excluded.token,expires_at=excluded.expires_at where probe_leases.expires_at<now();
 acquired:=found;
 if acquired then
  update probe_runs set status='failed',completed_at=now(),error='Runner stopped before completion' where status='running' and started_at<now()-interval '2 minutes';
  insert into probe_runs(id,status) values(p_token,'running');
 end if;
 return acquired;
end $$;
create function public.release_probe(p_token uuid) returns void language sql security definer set search_path=public as $$ delete from probe_leases where name='probe' and token=p_token $$;

create function public.commit_probe(p_token uuid,p_monitors jsonb,p_checks jsonb) returns void language plpgsql security definer set search_path=public as $$
declare c jsonb; i jsonb; previous text; mid text;
begin
 perform 1 from probe_leases where name='probe' and token=p_token and expires_at>now() for update;
 if not found then raise exception 'Probe lease expired'; end if;
 insert into monitors(id,name,category,endpoint_url,probe_type) select x->>'id',x->>'name',x->>'category',x->>'url',x->>'type' from jsonb_array_elements(p_monitors) x on conflict(id) do update set name=excluded.name,category=excluded.category,endpoint_url=excluded.endpoint_url,probe_type=excluded.probe_type;
 for c in select * from jsonb_array_elements(p_checks) loop
  mid:=c->>'monitor_id'; previous:=null;
  select status into previous from checks where monitor_id=mid and status<>'unknown' order by checked_at desc,id desc limit 1;
  insert into checks(monitor_id,status,latency_ms,status_code,checked_at,error) values(mid,c->>'status',(c->>'latency_ms')::int,(c->>'status_code')::int,(c->>'checked_at')::timestamptz,c->>'error');
  insert into snapshots values(mid,c->>'status',(c->>'latency_ms')::int,(c->>'status_code')::int,(c->>'checked_at')::timestamptz,c->>'error') on conflict(monitor_id) do update set status=excluded.status,latency_ms=excluded.latency_ms,status_code=excluded.status_code,checked_at=excluded.checked_at,error=excluded.error;
  if c->>'status'<>'unknown' and (select probe_type from monitors where id=mid)='incidentio' then
   update incidents set status='resolved',updated_at=(c->>'checked_at')::timestamptz where monitor_id=mid and status<>'resolved' and not exists(select 1 from jsonb_array_elements(c->'incidents') active where active->>'id'=incidents.id);
  end if;
  for i in select * from jsonb_array_elements(c->'incidents') loop
   insert into incidents values(i->>'id',mid,i->>'name',i->>'status',i->>'impact',i->>'url',(i->>'updated_at')::timestamptz,i->>'body') on conflict(monitor_id,id) do update set name=excluded.name,status=excluded.status,impact=excluded.impact,url=excluded.url,updated_at=excluded.updated_at,body=excluded.body;
  end loop;
  if previous is not null and previous<>'unknown' and c->>'status'<>'unknown' and previous<>c->>'status' then
   insert into alert_outbox(subscription_id,monitor_id,before_status,after_status) select id,mid,previous,c->>'status' from alert_subscriptions where monitor_id=mid;
  end if;
 end loop;
end $$;

create function public.claim_alerts() returns table(id bigint,destination text,monitor_id text,before_status text,after_status text) language plpgsql security definer set search_path=public as $$
begin
 return query with pending as (select o.id from alert_outbox o where o.delivered_at is null and o.attempts<5 and (o.claimed_until is null or o.claimed_until<now()) order by o.created_at limit 20 for update skip locked), claimed as (update alert_outbox o set claimed_until=now()+interval '2 minutes',attempts=o.attempts+1 from pending p where o.id=p.id returning o.*) select c.id,s.destination,c.monitor_id,c.before_status,c.after_status from claimed c join alert_subscriptions s on s.id=c.subscription_id;
end $$;

create function public.cleanup_history() returns void language plpgsql security definer set search_path=public as $$
begin
 insert into maintenance_state values('retention',now()) on conflict(name) do update set performed_at=excluded.performed_at where maintenance_state.performed_at<now()-interval '1 day';
 if not found then return; end if;
 delete from checks where id in(select id from checks where checked_at<now()-interval '30 days' limit 10000);
 delete from incidents where (monitor_id,id) in(select monitor_id,id from incidents where updated_at<now()-interval '90 days' limit 1000);
 delete from alert_outbox where id in(select id from alert_outbox where created_at<now()-interval '7 days' limit 10000);
 delete from probe_runs where id in(select id from probe_runs where started_at<now()-interval '7 days' limit 10000);
end $$;

revoke all on function public.acquire_probe(uuid),public.release_probe(uuid),public.commit_probe(uuid,jsonb,jsonb),public.claim_alerts(),public.cleanup_history() from public,anon,authenticated;
grant execute on function public.acquire_probe(uuid),public.release_probe(uuid),public.commit_probe(uuid,jsonb,jsonb),public.claim_alerts(),public.cleanup_history() to service_role;
