-- Standalone OJ Solutions 15-minute consultation requests.
-- NO public table access: submissions pass through a validated server-side Edge Function.
create table if not exists public.oj_solutions_consultations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  name text not null check (length(btrim(name)) between 2 and 160),
  email text not null check (length(email) between 5 and 200),
  phone text not null default '' check (length(phone) <= 35),
  business text not null default '' check (length(business) <= 160),
  service text not null default 'General consultation' check (length(service) between 1 and 100),
  notes text not null default '' check (length(notes) <= 1000),
  preferred_date date not null,
  preferred_time time without time zone not null,
  duration_minutes integer not null default 15 check (duration_minutes=15),
  status text not null default 'requested' check(status in ('requested','confirmed','declined','completed')),
  source text not null default 'ojsolutions.org' check(length(source) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oj_solutions_valid_slot check (
    extract(isodow from preferred_date) between 1 and 5
    and preferred_time >= time '09:00'
    and preferred_time <= time '16:45'
    and extract(minute from preferred_time)::int % 15 = 0
    and extract(second from preferred_time)::int = 0
  ),
  unique (organization_id, email, preferred_date, preferred_time)
);
create index if not exists oj_solutions_consultations_org_date_idx
  on public.oj_solutions_consultations(organization_id, preferred_date, preferred_time);
create index if not exists oj_solutions_consultations_org_status_idx
  on public.oj_solutions_consultations(organization_id, status, created_at desc);
-- Only one consultation may be manually confirmed for a given slot.
create unique index if not exists oj_solutions_one_confirmed_slot
  on public.oj_solutions_consultations(organization_id,preferred_date,preferred_time)
  where status='confirmed';

alter table public.oj_solutions_consultations enable row level security;
revoke all on public.oj_solutions_consultations from public, anon, authenticated;
grant select on public.oj_solutions_consultations to authenticated;
grant update (status) on public.oj_solutions_consultations to authenticated;
create policy oj_solutions_consultations_member_read
  on public.oj_solutions_consultations for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy oj_solutions_consultations_member_update
  on public.oj_solutions_consultations for update to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'))
  with check (oj_private.member_role(organization_id) in ('owner','member'));

create or replace function oj_private.oj_solutions_consultation_touch()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.organization_id <> old.organization_id
     or new.email <> old.email or new.name <> old.name
     or new.preferred_date <> old.preferred_date or new.preferred_time <> old.preferred_time
     or new.created_at <> old.created_at then
    raise exception 'Consultation identity and requested slot are immutable';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function oj_private.oj_solutions_consultation_touch() from public;
create trigger oj_solutions_consultation_guard
before update on public.oj_solutions_consultations
for each row execute function oj_private.oj_solutions_consultation_touch();
