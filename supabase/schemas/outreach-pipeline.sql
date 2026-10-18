-- OJ Solutions prospecting pipeline fed from the private Google Sheets source.
-- The scheduled Netlify function reads the sheet with a file-scoped Google
-- service account and writes only source columns using the Supabase service
-- key held server-side. Browser actions use the member session and a narrow RPC.

create table public.oj_outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  source_key text not null check (source_key ~ '^[a-f0-9]{64}$'),
  source_row integer not null check (source_row between 2 and 1000),
  business_name text not null check (length(btrim(business_name)) between 1 and 200),
  industry text check (industry is null or length(industry) <= 160),
  city_state text check (city_state is null or length(city_state) <= 240),
  website_url text check (website_url is null or length(website_url) <= 1000),
  phone_number text check (phone_number is null or length(phone_number) <= 80),
  decision_maker text check (decision_maker is null or length(decision_maker) <= 200),
  best_fit_service text check (best_fit_service is null or length(best_fit_service) <= 120),
  secondary_fit text check (secondary_fit is null or length(secondary_fit) <= 120),
  leak text check (leak is null or length(leak) <= 2000),
  evidence text check (evidence is null or length(evidence) <= 3000),
  email text check (email is null or length(email) <= 320),
  instagram text check (instagram is null or length(instagram) <= 1000),
  facebook text check (facebook is null or length(facebook) <= 1000),
  email_subject text check (email_subject is null or length(email_subject) <= 500),
  email_body text check (email_body is null or length(email_body) <= 5000),
  dm text check (dm is null or length(dm) <= 3000),
  date_added date,
  sent_by text check (sent_by is null or sent_by in ('Oscar','Jacob')),
  source_status text not null default 'Not Sent' check (source_status in ('Not Sent','Emailed','DMed','Emailed + DMed','Replied','Demo Booked','Not Interested','Dead')),
  source_notes text check (source_notes is null or length(source_notes) <= 3000),
  outreach_status text check (outreach_status is null or outreach_status in ('Not Sent','Emailed','DMed','Emailed + DMed','Replied','Demo Booked','Not Interested','Dead')),
  status_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_key),
  unique (organization_id, id)
);
create index oj_outreach_pipeline on public.oj_outreach_prospects(organization_id, date_added desc, sent_by, source_status);
create index oj_outreach_source_row on public.oj_outreach_prospects(organization_id, source_row);

create table public.oj_outreach_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  prospect_id uuid not null,
  actor_id uuid not null references auth.users(id),
  previous_status text not null check (previous_status in ('Not Sent','Emailed','DMed','Emailed + DMed','Replied','Demo Booked','Not Interested','Dead')),
  new_status text not null check (new_status in ('Not Sent','Emailed','DMed','Emailed + DMed','Replied','Demo Booked','Not Interested','Dead')),
  created_at timestamptz not null default now(),
  foreign key (organization_id, prospect_id) references public.oj_outreach_prospects(organization_id, id)
);
create index oj_outreach_activity_prospect on public.oj_outreach_activity(organization_id, prospect_id, created_at desc);

create table public.oj_outreach_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  status text not null check (status in ('success','partial','failed')),
  rows_seen integer not null default 0 check (rows_seen between 0 and 1000),
  rows_written integer not null default 0 check (rows_written between 0 and 1000),
  rows_skipped integer not null default 0 check (rows_skipped between 0 and 1000),
  duplicate_rows integer not null default 0 check (duplicate_rows between 0 and 1000),
  error_summary text not null default '' check (length(error_summary) <= 500),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);
create index oj_outreach_runs on public.oj_outreach_sync_runs(organization_id, started_at desc);

alter table public.oj_outreach_prospects enable row level security;
alter table public.oj_outreach_activity enable row level security;
alter table public.oj_outreach_sync_runs enable row level security;
revoke all on public.oj_outreach_prospects, public.oj_outreach_activity, public.oj_outreach_sync_runs from public, anon, authenticated;
grant select on public.oj_outreach_prospects, public.oj_outreach_activity, public.oj_outreach_sync_runs to authenticated;
grant select, insert, update on public.oj_outreach_prospects to service_role;
grant select, insert, update on public.oj_outreach_sync_runs to service_role;

create policy oj_outreach_member_read on public.oj_outreach_prospects for select to authenticated
  using (oj_private.member_role(organization_id) is not null);
create policy oj_outreach_activity_member_read on public.oj_outreach_activity for select to authenticated
  using (oj_private.member_role(organization_id) is not null);
create policy oj_outreach_runs_member_read on public.oj_outreach_sync_runs for select to authenticated
  using (oj_private.member_role(organization_id) is not null);

-- Status changes stay session-bound, are atomic with their audit entry, and
-- never grant dashboard members permission to modify imported prospect data.
create function public.oj_set_outreach_status(p_organization_id uuid, p_prospect_id uuid, p_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare previous text; effective text;
begin
  if auth.uid() is null or not coalesce(oj_private.member_role(p_organization_id) in ('owner','member'), false) then
    raise exception 'Workspace member access required';
  end if;
  if p_status is null or p_status not in ('Not Sent','Emailed','DMed','Emailed + DMed','Replied','Demo Booked','Not Interested','Dead') then
    raise exception 'Invalid outreach status';
  end if;
  select coalesce(p.outreach_status,p.source_status), p.outreach_status
    into effective, previous
    from public.oj_outreach_prospects p
    where p.organization_id=p_organization_id and p.id=p_prospect_id
    for update;
  if not found then raise exception 'Prospect not found'; end if;
  if effective = p_status then return p_status; end if;
  update public.oj_outreach_prospects
    set outreach_status=p_status, status_updated_at=now(), updated_at=now()
    where organization_id=p_organization_id and id=p_prospect_id;
  insert into public.oj_outreach_activity(organization_id,prospect_id,actor_id,previous_status,new_status)
    values (p_organization_id,p_prospect_id,auth.uid(),effective,p_status);
  return p_status;
end $$;
revoke all on function public.oj_set_outreach_status(uuid,uuid,text) from public, anon;
grant execute on function public.oj_set_outreach_status(uuid,uuid,text) to authenticated;
