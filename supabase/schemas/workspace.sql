-- Desired additive OJ workspace schema. User selected the Exterior Care project.
-- Inspect existing objects and stage the generated migration before applying to that live project.
-- Apply via the deployment runbook. No legacy tables or personal STRATHOS data are referenced.
create schema if not exists oj_private;
revoke all on schema oj_private from public;
grant usage on schema oj_private to authenticated;

create table public.oj_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.oj_memberships (
  organization_id uuid not null references public.oj_organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','member','viewer')),
  display_name text not null check (length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id),
  unique (organization_id,display_name)
);
create index oj_memberships_user on public.oj_memberships(user_id,organization_id);

-- Narrow definer function breaks membership-policy recursion. No user-id parameter:
-- caller identity always comes from the verified JWT. Private schema is not Data API exposed.
create function oj_private.member_role(org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.oj_memberships
  where organization_id = org and user_id = (select auth.uid())
$$;
revoke all on function oj_private.member_role(uuid) from public;
grant execute on function oj_private.member_role(uuid) to authenticated;

create table public.oj_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  title text not null check (length(btrim(title)) between 1 and 180),
  description text not null default '' check (length(description) <= 8000),
  business text not null check (business in ('exterior','solutions')),
  stage text not null default 'Backlog' check (stage in ('Backlog','Ready','In progress','Review','Done')),
  priority text not null default 'normal' check (priority in ('normal','high')),
  assignee text not null default '' check (length(assignee) <= 120),
  due_date date,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 40),
  revision integer not null default 0 check (revision >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index oj_cards_org_stage on public.oj_cards(organization_id,stage,created_at);
create index oj_cards_creator on public.oj_cards(created_by);
create table public.oj_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  card_id uuid not null,
  author_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (organization_id,card_id) references public.oj_cards(organization_id,id)
);
create index oj_comments_card on public.oj_comments(organization_id,card_id,created_at);
create index oj_comments_author on public.oj_comments(author_id);
create table public.oj_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  card_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('card_created','card_updated','comment_added')),
  revision integer,
  created_at timestamptz not null default now(),
  foreign key (organization_id,card_id) references public.oj_cards(organization_id,id)
);
create index oj_activity_org on public.oj_activity(organization_id,created_at);
create index oj_activity_card on public.oj_activity(card_id);
create index oj_activity_actor on public.oj_activity(actor_id);

alter table public.oj_organizations enable row level security;
alter table public.oj_memberships enable row level security;
alter table public.oj_cards enable row level security;
alter table public.oj_comments enable row level security;
alter table public.oj_activity enable row level security;

revoke all on public.oj_organizations,public.oj_memberships,public.oj_cards,public.oj_comments,public.oj_activity from anon,authenticated;
grant select on public.oj_organizations,public.oj_memberships,public.oj_cards,public.oj_comments,public.oj_activity to authenticated;
grant insert on public.oj_cards,public.oj_comments to authenticated;
grant update (title,description,business,stage,priority,assignee,due_date,checklist,revision) on public.oj_cards to authenticated;

create policy org_read on public.oj_organizations for select to authenticated using (oj_private.member_role(id) is not null);
create policy member_read on public.oj_memberships for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy card_read on public.oj_cards for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy card_create on public.oj_cards for insert to authenticated with check (
  oj_private.member_role(organization_id) in ('owner','member') and created_by = (select auth.uid()) and revision = 0
);
create policy card_update on public.oj_cards for update to authenticated
using (oj_private.member_role(organization_id) in ('owner','member'))
with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy comment_read on public.oj_comments for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy comment_create on public.oj_comments for insert to authenticated with check (
  oj_private.member_role(organization_id) in ('owner','member') and author_id = (select auth.uid())
);
create policy activity_read on public.oj_activity for select to authenticated using (oj_private.member_role(organization_id) is not null);

create function oj_private.guard_card() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.organization_id <> old.organization_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'Card identity is immutable';
    end if;
    if new.revision <> old.revision then raise exception 'Stale card revision'; end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  if new.assignee <> '' and not exists (
    select 1 from public.oj_memberships where organization_id = new.organization_id and display_name = new.assignee
  ) then raise exception 'Assignee is not a workspace member'; end if;
  for item in select value from jsonb_array_elements(new.checklist) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'id') is distinct from 'string'
      or jsonb_typeof(item->'text') is distinct from 'string'
      or length(btrim(item->>'text')) not between 1 and 300
      or jsonb_typeof(item->'done') is distinct from 'boolean'
    then raise exception 'Invalid checklist item'; end if;
  end loop;
  return new;
end $$;
revoke all on function oj_private.guard_card() from public;
create trigger guard_card before insert or update on public.oj_cards for each row execute function oj_private.guard_card();

-- Trigger is the only writer of activity. It cannot be invoked through a public RPC.
create function oj_private.record_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'An authenticated actor is required'; end if;
  if oj_private.member_role(new.organization_id) not in ('owner','member') then raise exception 'Workspace write access required'; end if;
  if tg_table_name = 'oj_comments' then
    insert into public.oj_activity(organization_id,card_id,actor_id,action) values(new.organization_id,new.card_id,auth.uid(),'comment_added');
  else
    insert into public.oj_activity(organization_id,card_id,actor_id,action,revision)
    values(new.organization_id,new.id,auth.uid(),case when tg_op = 'INSERT' then 'card_created' else 'card_updated' end,new.revision);
  end if;
  return new;
end $$;
revoke all on function oj_private.record_activity() from public;
create trigger card_activity after insert or update on public.oj_cards for each row execute function oj_private.record_activity();
create trigger comment_activity after insert on public.oj_comments for each row execute function oj_private.record_activity();
