-- OJ Solutions email engine: settings, heartbeat and the send/reply/bounce log.
--
-- Desired state. Apply after outreach-pipeline.sql (already live). NOT applied
-- to the live project: a founder reviews and applies it. Everything is additive:
-- three new tables and one function. No existing row or table is changed.
--
-- The engine itself is the spreadsheet-bound Apps Script in scripts/google-apps-script/.
-- It talks only to netlify/functions/outreach-email-engine.ts, which holds the
-- service key and writes the state and event tables. Members read them here and
-- change only the switch, the cap and the niche through oj_set_email_engine.

create table public.oj_email_engine_settings (
  organization_id uuid primary key references public.oj_organizations(id),
  enabled boolean not null default true,
  daily_cap_max integer not null default 25 check (daily_cap_max between 1 and 40),
  niche_filter text check (niche_filter is null or length(btrim(niche_filter)) between 1 and 80),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.oj_email_engine_state (
  organization_id uuid primary key references public.oj_organizations(id),
  last_heartbeat_at timestamptz not null default now(),
  state text not null check (state in ('sending','idle','outside-window','cap-reached','paused','braked','blocked','nothing-to-send')),
  detail text not null default '' check (length(detail) <= 300),
  warmup_started_on date,
  sender_domain text check (sender_domain is null or length(sender_domain) <= 120),
  updated_at timestamptz not null default now()
);

create table public.oj_email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  prospect_id uuid not null,
  kind text not null check (kind in ('reserved','sent','failed','reply','bounce','stop')),
  dedupe_key text not null check (length(dedupe_key) between 1 and 200),
  detail text not null default '' check (length(detail) <= 300),
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key),
  foreign key (organization_id, prospect_id) references public.oj_outreach_prospects(organization_id, id)
);
create index oj_email_events_time on public.oj_email_events(organization_id, event_at desc);
create index oj_email_events_prospect on public.oj_email_events(organization_id, prospect_id, kind);
create index oj_email_engine_settings_user on public.oj_email_engine_settings(updated_by) where updated_by is not null;

alter table public.oj_email_engine_settings enable row level security;
alter table public.oj_email_engine_state enable row level security;
alter table public.oj_email_events enable row level security;
revoke all on public.oj_email_engine_settings, public.oj_email_engine_state, public.oj_email_events from public, anon, authenticated;
grant select on public.oj_email_engine_settings, public.oj_email_engine_state, public.oj_email_events to authenticated;
grant select on public.oj_email_engine_settings to service_role;
grant select, insert, update on public.oj_email_engine_state to service_role;
grant select, insert on public.oj_email_events to service_role;

create policy oj_email_settings_read on public.oj_email_engine_settings for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy oj_email_state_read on public.oj_email_engine_state for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy oj_email_events_read on public.oj_email_events for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));

-- The pause switch, the daily ceiling and the niche. Nothing else about the
-- engine can be changed from the dashboard.
create function public.oj_set_email_engine(p_organization_id uuid, p_enabled boolean, p_daily_cap_max integer, p_niche_filter text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare niche text := nullif(btrim(coalesce(p_niche_filter, '')), '');
begin
  if auth.uid() is null or not coalesce(oj_private.member_role(p_organization_id) in ('owner','member'), false) then
    raise exception 'Workspace member access required';
  end if;
  if p_enabled is null then raise exception 'Choose on or off'; end if;
  if p_daily_cap_max is null or p_daily_cap_max < 1 or p_daily_cap_max > 40 then raise exception 'Daily cap must be between 1 and 40'; end if;
  if niche is not null and length(niche) > 80 then raise exception 'Niche is too long'; end if;
  insert into public.oj_email_engine_settings(organization_id, enabled, daily_cap_max, niche_filter, updated_by)
    values (p_organization_id, p_enabled, p_daily_cap_max, niche, auth.uid())
    on conflict (organization_id) do update
      set enabled = excluded.enabled, daily_cap_max = excluded.daily_cap_max,
          niche_filter = excluded.niche_filter, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('enabled', p_enabled, 'daily_cap_max', p_daily_cap_max, 'niche_filter', niche);
end $$;
revoke all on function public.oj_set_email_engine(uuid,boolean,integer,text) from public, anon;
grant execute on function public.oj_set_email_engine(uuid,boolean,integer,text) to authenticated;
