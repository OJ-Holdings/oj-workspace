-- OJ Workspace V2, fourth-business foundation (manual deployment gate).
-- NOT YET APPLIED TO PRODUCTION. DO NOT MERGE OR EXECUTE BEFORE:
-- 1) verifying the actual migration history and backup/restore,
-- 2) running all PGlite role-isolation tests,
-- 3) confirming a supervised compatible frontend release.
-- Does not touch legacy Exterior Care tables, existing accounts or STRATHOS.
--
-- Forward-only schema addition. Existing business records and IDs are preserved.
-- The deployment runbook must report before/after counts for all seven
-- affected workspace tables. No deletion or rewrite of existing user records.
--
-- The older 3-item CHECK constraints are replaced by *per-organization*
-- composite foreign keys to an extensible venture registry. A shared/null
-- venture remains accepted where it was accepted previously.

create table public.oj_ventures (
  organization_id uuid not null references public.oj_organizations(id),
  slug text not null check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  short_name text not null check (length(btrim(short_name)) between 1 and 60),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, slug)
);

alter table public.oj_ventures enable row level security;
revoke all on table public.oj_ventures from public, anon, authenticated;
grant select on public.oj_ventures to authenticated;
create policy oj_venture_member_read on public.oj_ventures
  for select to authenticated
  using (oj_private.member_role(organization_id) is not null);

create index oj_ventures_active on public.oj_ventures(organization_id, active, sort_order, slug);

-- Seed existing organizations without changing any existing records.
insert into public.oj_ventures (organization_id, slug, name, short_name, sort_order)
select o.id, v.slug, v.name, v.short_name, v.sort_order
from public.oj_organizations o
cross join (values
  ('exterior','OJ Exterior Care','Exterior Care',10),
  ('solutions','OJ Solutions','Solutions',20),
  ('essentials','OJ Essentials','Essentials',30),
  ('content','Oscar Jacob','Oscar Jacob',40)
) as v(slug,name,short_name,sort_order);

-- All future organizations should start with these operating areas as well.
-- The trigger runs as its normal invoker; application users cannot create
-- organizations or manipulate this registry by direct grants.
create function oj_private.seed_oj_ventures() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.oj_ventures(organization_id,slug,name,short_name,sort_order)
  values
    (new.id,'exterior','OJ Exterior Care','Exterior Care',10),
    (new.id,'solutions','OJ Solutions','Solutions',20),
    (new.id,'essentials','OJ Essentials','Essentials',30),
    (new.id,'content','Oscar Jacob','Oscar Jacob',40);
  return new;
end $$;
revoke all on function oj_private.seed_oj_ventures() from public,anon,authenticated;
create trigger seed_oj_ventures_after_org_insert
  after insert on public.oj_organizations
  for each row execute function oj_private.seed_oj_ventures();

-- Retain existing nullable semantics on messages/events/documents. Never delete
-- or remap the existing venture value. Composite FK prevents unknown brands.
alter table public.oj_cards drop constraint oj_cards_business_check;
alter table public.oj_cards
  add constraint oj_cards_registered_business
  foreign key (organization_id, business)
  references public.oj_ventures(organization_id, slug);

alter table public.oj_messages drop constraint oj_messages_venture_check;
alter table public.oj_messages
  add constraint oj_messages_registered_venture
  foreign key (organization_id, venture)
  references public.oj_ventures(organization_id, slug);

alter table public.oj_leads drop constraint oj_leads_venture_check;
alter table public.oj_leads
  add constraint oj_leads_registered_venture
  foreign key (organization_id, venture)
  references public.oj_ventures(organization_id, slug);

alter table public.oj_finance_entries drop constraint oj_finance_entries_venture_check;
alter table public.oj_finance_entries
  add constraint oj_finance_entries_registered_venture
  foreign key (organization_id, venture)
  references public.oj_ventures(organization_id, slug);

alter table public.oj_metric_entries drop constraint oj_metric_entries_venture_check;
alter table public.oj_metric_entries
  add constraint oj_metric_entries_registered_venture
  foreign key (organization_id, venture)
  references public.oj_ventures(organization_id, slug);

alter table public.oj_events drop constraint oj_events_venture_check;
alter table public.oj_events
  add constraint oj_events_registered_venture
  foreign key (organization_id, venture)
  references public.oj_ventures(organization_id, slug);

alter table public.oj_documents drop constraint oj_documents_venture_check;
alter table public.oj_documents
  add constraint oj_documents_registered_venture
  foreign key (organization_id, venture)
  references public.oj_ventures(organization_id, slug);

-- Oscar Jacob's production entities. A planned publication is never marked
-- "Published" without a user-recorded public link and recorded time. The
-- publication link is user-provided, NOT verified with any platform API.
create table public.oj_content_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  title text not null check (length(btrim(title)) between 1 and 180),
  kind text not null default 'Video'
    check (kind in ('Video','Short','Series','Campaign','Other')),
  stage text not null default 'Idea'
    check (stage in ('Idea','Research','Script','Pre-production','Filming','Editing','Review','Scheduled','Published','Archived')),
  platforms text[] not null default '{}'::text[]
    check (array_length(platforms,1) is null or array_length(platforms,1) <= 8),
  summary text not null default '' check (length(summary) <= 3000),
  script text not null default '' check (length(script) <= 16000),
  production_notes text not null default '' check (length(production_notes) <= 5000),
  assigned_to uuid references auth.users(id),
  shoot_at timestamptz,
  target_publish_on date,
  published_url text not null default '' check (
    published_url = '' or (length(published_url) between 12 and 1000
      and published_url ~ '^https://[^[:space:]]+$')
  ),
  published_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint content_published_requires_receipt
    check (stage <> 'Published' or (published_url <> '' and published_at is not null))
);
create index oj_content_projects_work on public.oj_content_projects(organization_id, stage, target_publish_on);
create index oj_content_projects_assignee on public.oj_content_projects(organization_id, assigned_to, updated_at desc);

alter table public.oj_content_projects enable row level security;
revoke all on public.oj_content_projects from public,anon,authenticated;
grant select,insert on public.oj_content_projects to authenticated;
grant update (title,kind,stage,platforms,summary,script,production_notes,assigned_to,
  shoot_at,target_publish_on,published_url,published_at,revision)
  on public.oj_content_projects to authenticated;

create policy content_member_read on public.oj_content_projects
  for select to authenticated
  using (oj_private.member_role(organization_id) is not null);
create policy content_member_add on public.oj_content_projects
  for insert to authenticated
  with check (
    oj_private.member_role(organization_id) in ('owner','member')
    and created_by = (select auth.uid())
    and revision = 0
  );
create policy content_member_edit on public.oj_content_projects
  for update to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'))
  with check (oj_private.member_role(organization_id) in ('owner','member'));

-- Audit receipts are insert-only by a private, controlled trigger, not by a
-- client-controlled RPC. All actions remain attributable and tenant-scoped.
create table public.oj_content_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  actor_id uuid references auth.users(id),
  action text not null check (action in ('created','updated','stage_changed')),
  previous_stage text,
  new_stage text,
  changed_at timestamptz not null default now(),
  foreign key (organization_id,project_id)
    references public.oj_content_projects(organization_id,id)
);
create index oj_content_activity_project on public.oj_content_activity(organization_id,project_id,changed_at desc);
alter table public.oj_content_activity enable row level security;
revoke all on public.oj_content_activity from public,anon,authenticated;
grant select on public.oj_content_activity to authenticated;
create policy content_activity_member_read on public.oj_content_activity
  for select to authenticated
  using (oj_private.member_role(organization_id) is not null);

create function oj_private.guard_and_audit_content() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  audit_action text;
begin
  actor := (select auth.uid());
  if tg_op = 'INSERT' then
    if new.revision <> 0 then raise exception 'Invalid initial revision'; end if;
    if actor is not null and new.created_by is distinct from actor
      then raise exception 'Cannot forge creator'; end if;
    audit_action := 'created';
  else
    if new.id is distinct from old.id
      or new.organization_id is distinct from old.organization_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      then raise exception 'Content identity is immutable'; end if;
    if new.revision <> old.revision
      then raise exception 'Stale content revision'; end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
    audit_action := case when new.stage is distinct from old.stage
      then 'stage_changed' else 'updated' end;
  end if;

  if new.assigned_to is not null and not exists (
    select 1 from public.oj_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.assigned_to
      and m.role in ('owner','member')
  ) then raise exception 'Assignee must be a current workspace operator'; end if;

  if new.stage = 'Published' and (new.published_url = '' or new.published_at is null)
    then raise exception 'Published items require a recorded public link and date'; end if;

  insert into public.oj_content_activity
    (organization_id,project_id,actor_id,action,previous_stage,new_stage)
  values (new.organization_id,new.id,actor,audit_action,
    case when tg_op = 'UPDATE' then old.stage else null end,new.stage);
  return new;
end $$;
revoke all on function oj_private.guard_and_audit_content() from public,anon,authenticated;
create trigger guard_content_project
  before insert or update on public.oj_content_projects
  for each row execute function oj_private.guard_and_audit_content();

-- Historical verified data is not copied to the content studio. It starts empty.
-- Future asset/version/analytics/sponsorship tables are separate releases.
