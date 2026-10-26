-- Applied to the configured OJ project by owner-authorized release on 2026-10-26.
-- Supabase migration 20261026144619: oj_content_studio_shared_records.
-- Retained for independent recovery/synthetic tests; do not reapply blindly.
-- Uses the existing OJ organization/membership system; no other venture is changed.
begin;
create table public.oj_content_projects (
  id uuid primary key,
  organization_id uuid not null references public.oj_organizations(id),
  title text not null check (length(title)<=180 and length(btrim(title))>=1),
  kind text not null check (kind in ('Video','Short','Series','Campaign','Other')),
  stage text not null check (stage in ('Idea','Research','Script','Pre-production','Filming','Editing','Review','Scheduled','Published','Archived')),
  platforms text[] not null default '{}',
  summary text not null default '' check (length(summary)<=3000),
  script text not null default '' check (length(script)<=16000),
  production_notes text not null default '' check (length(production_notes)<=5000),
  assigned_to uuid references auth.users(id),
  shoot_at timestamptz,
  target_publish_on date,
  published_url text not null default '' check (length(published_url)<=1000 and (published_url='' or published_url ~ '^https://[^[:space:]]+$')),
  published_at timestamptz,
  revision integer not null default 0 check (revision>=0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  check (stage<>'Published' or (published_url<>'' and published_at is not null)),
  check (array_position(platforms,null) is null and platforms <@ array['YouTube','TikTok','Instagram','Other']::text[] and
    cardinality(platforms)=(('YouTube'=any(platforms))::int+('TikTok'=any(platforms))::int+
      ('Instagram'=any(platforms))::int+('Other'=any(platforms))::int))
);
create index oj_content_projects_page on public.oj_content_projects(organization_id,updated_at desc,id);

create table public.oj_content_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','updated','stage_changed')),
  previous_stage text,
  new_stage text not null,
  changed_at timestamptz not null default now(),
  foreign key (organization_id,project_id) references public.oj_content_projects(organization_id,id)
);
create index oj_content_activity_page on public.oj_content_activity(organization_id,changed_at desc,id);
alter table public.oj_content_projects enable row level security;
alter table public.oj_content_activity enable row level security;
create policy oj_content_projects_read on public.oj_content_projects for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member','viewer'));
create policy oj_content_projects_insert on public.oj_content_projects for insert to authenticated
  with check (oj_private.member_role(organization_id) in ('owner','member') and created_by=(select auth.uid()));
create policy oj_content_projects_update on public.oj_content_projects for update to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'))
  with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy oj_content_activity_read on public.oj_content_activity for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member','viewer'));
revoke all on public.oj_content_projects,public.oj_content_activity from public,anon,authenticated;
grant select,insert,update on public.oj_content_projects to authenticated;
grant select on public.oj_content_activity to authenticated;

create function oj_private.guard_content_project() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (select auth.uid()) is null or coalesce(oj_private.member_role(new.organization_id),'') not in ('owner','member') then
    raise exception 'Content access denied' using errcode='42501';
  end if;
  if new.assigned_to is not null and not exists (
    select 1 from public.oj_memberships m where m.organization_id=new.organization_id
      and m.user_id=new.assigned_to and m.role in ('owner','member')) then
    raise exception 'Content assignee is not an active company teammate' using errcode='23514';
  end if;
  if tg_op='INSERT' then
    if new.revision<>0 or new.created_by is distinct from (select auth.uid()) then
      raise exception 'Invalid initial content revision or author' using errcode='23514';
    end if;
    new.created_at:=now();
  else
    if new.id is distinct from old.id or new.organization_id is distinct from old.organization_id
      or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'Content identity is immutable' using errcode='23514';
    end if;
    if new.revision<>old.revision then
      raise exception 'Content revision changed; reload before saving' using errcode='40001';
    end if;
    new.revision:=old.revision+1;
  end if;
  new.updated_at:=now();
  return new;
end $$;
revoke all on function oj_private.guard_content_project() from public,anon,authenticated;
create trigger oj_content_project_guard before insert or update on public.oj_content_projects
  for each row execute function oj_private.guard_content_project();

-- Narrow trigger-only definer: members cannot INSERT/forge/edit activity rows.
-- Identity comes from auth.uid(), never caller-supplied actor metadata.
create function oj_private.record_content_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or coalesce(oj_private.member_role(new.organization_id),'') not in ('owner','member') then
    raise exception 'Content activity access denied' using errcode='42501';
  end if;
  insert into public.oj_content_activity(organization_id,project_id,actor_id,action,previous_stage,new_stage)
    values(new.organization_id,new.id,(select auth.uid()),
      case when tg_op='INSERT' then 'created' when old.stage is distinct from new.stage then 'stage_changed' else 'updated' end,
      case when tg_op='INSERT' then null else old.stage end,new.stage);
  return new;
end $$;
revoke all on function oj_private.record_content_activity() from public,anon,authenticated;
create trigger oj_content_project_activity after insert or update on public.oj_content_projects
  for each row execute function oj_private.record_content_activity();
commit;
