-- OJ OS: Local Services Ads lead engine for Exterior Care.
-- Additive only: new columns on the Exterior Care leads table and two new tables
-- (oj_lsa_sync for the sync state, oj_lsa_review for possible duplicates).
-- Nothing existing is changed or removed. Take a backup, then run once in the
-- Supabase SQL editor. Until it is run, the Lead inbox says so and every other
-- screen works as before.
begin;

-- The existing leads table keeps its policies: owners and members read and edit,
-- viewers and strangers get nothing. These columns ride on those policies.
alter table public.leads
  add column lsa_lead_id text check (lsa_lead_id ~ '^[0-9]{1,25}$'),
  -- Google's lead details: every LSA lead id linked to this lead, type, category, service, status, charge and credit.
  add column lsa jsonb check (lsa is null or jsonb_typeof(lsa) = 'object'),
  -- Message leads show a Google proxy number with an extension. It is never stored as the real phone.
  add column proxy_phone text check (proxy_phone is null or length(proxy_phone) <= 60),
  add column stage text check (stage in ('new','contacted','quoted','scheduled','won','lost','dead')),
  add column stage_at timestamptz,
  add column attempts integer not null default 0 check (attempts between 0 and 100),
  add column contact_log jsonb not null default '[]'::jsonb check (jsonb_typeof(contact_log) = 'array'),
  add column thread jsonb not null default '[]'::jsonb check (jsonb_typeof(thread) = 'array'),
  add column cycle_at timestamptz,
  add column last_customer_at timestamptz,
  add column last_ours_at timestamptz,
  add column quoted_at timestamptz,
  add column scheduled_on date,
  add column dead_reason text check (dead_reason is null or length(dead_reason) <= 300),
  add column archived_at timestamptz,
  add column revive_on date,
  add column original_status text check (original_status is null or length(original_status) <= 60),
  add column dispute boolean not null default false,
  add column auto_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(auto_fields) = 'array');
-- Kept separate so a table that already has an email column is left as it is.
alter table public.leads add column if not exists email text check (email is null or length(email) <= 320);

-- One workspace lead per LSA lead id, never two.
create unique index leads_lsa_lead_id_key on public.leads(lsa_lead_id) where lsa_lead_id is not null;
create index leads_archived_revive on public.leads(revive_on) where archived_at is not null;

-- Where the sync is up to, how many Google API operations it has used today, and the last error (shown as a banner).
create table public.oj_lsa_sync (
  organization_id uuid primary key references public.oj_organizations(id),
  lead_checkpoint timestamptz,
  event_checkpoint timestamptz,
  backfill jsonb not null default '{}'::jsonb check (jsonb_typeof(backfill) = 'object'),
  ops_day date,
  ops_used integer not null default 0 check (ops_used >= 0),
  last_run_at timestamptz,
  last_ok_at timestamptz,
  error_kind text check (error_kind in ('setup','token','quota','access','api')),
  last_error text check (last_error is null or length(last_error) <= 2000),
  last_result jsonb,
  updated_at timestamptz not null default now()
);
alter table public.oj_lsa_sync enable row level security;
revoke all on public.oj_lsa_sync from anon, authenticated;
grant select, insert, update on public.oj_lsa_sync to authenticated;

-- Owners and members (the people who can see the leads) read it and run Sync now.
-- Viewers and other workspaces get nothing. The Windows host's poller writes it with the server-only key.
create policy member_read on public.oj_lsa_sync for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy member_add on public.oj_lsa_sync for insert to authenticated
  with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy member_change on public.oj_lsa_sync for update to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'))
  with check (oj_private.member_role(organization_id) in ('owner','member'));

-- Possible duplicates: an LSA lead that might be someone already in the workspace is
-- held here (not added, not linked) until someone taps Merge or Keep separate.
-- Rows are never deleted: a decided review is marked done once it has been carried out.
create table public.oj_lsa_review (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  lsa_lead_id text not null check (lsa_lead_id ~ '^[0-9]{1,25}$'),
  -- Google's lead as read, the conversation so far, and the workspace leads it might be.
  lead jsonb not null check (jsonb_typeof(lead) = 'object'),
  thread jsonb not null default '[]'::jsonb check (jsonb_typeof(thread) = 'array'),
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates) = 'array'),
  reason text check (reason is null or length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending','merge','separate','done')),
  -- The lead to merge into. No foreign key: the review must never block or follow a change to a lead.
  merge_into uuid,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, lsa_lead_id),
  check (status <> 'merge' or merge_into is not null)
);
alter table public.oj_lsa_review enable row level security;
revoke all on public.oj_lsa_review from anon, authenticated;
grant select, insert, update on public.oj_lsa_review to authenticated;

-- Owners and members (the people who see the leads) read, add and decide. Viewers and other
-- workspaces get nothing. No delete for anyone signed in.
create policy member_read on public.oj_lsa_review for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy member_add on public.oj_lsa_review for insert to authenticated
  with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy member_change on public.oj_lsa_review for update to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'))
  with check (oj_private.member_role(organization_id) in ('owner','member'));

commit;
