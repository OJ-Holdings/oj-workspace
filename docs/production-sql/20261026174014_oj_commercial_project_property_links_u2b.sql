-- APPLIED to Supabase project OJ Exterior, migration version 20261026174014.
-- Archived source for historical audit; DO NOT automatically reapply.
-- All changes are additive. This is not a new/pending deployment migration.
-- U2B REVIEW/STAGING SQL ONLY: do not apply in live Supabase without
-- separately approved migration, real recovery, Storage byte restore, and
-- Oscar/Jacob actor acceptance. Install AFTER U2 Commercial Accounts migration.
-- Project/company/property links require exact UUIDs; never infer from names.
-- Link rows do NOT issue quotes, work orders, invoices, recurring contracts
-- or imply booking acceptance.
create table public.oj_commercial_project_links (
 organization_id uuid not null,
 project_id uuid not null,
 account_id uuid,
 property_id uuid,
 revision integer not null check(revision between 1 and 10000000),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,project_id),
 foreign key(organization_id,project_id)
  references public.oj_commercial_projects(organization_id,id) on delete restrict,
 foreign key(organization_id,account_id)
  references public.oj_commercial_accounts(organization_id,id) on delete restrict,
 foreign key(organization_id,account_id,property_id)
  references public.oj_commercial_properties(organization_id,account_id,id) on delete restrict,
 check ((account_id is null and property_id is null)
   or (account_id is not null and property_id is not null))
);
create index oj_commercial_project_links_account_idx
 on public.oj_commercial_project_links(organization_id,account_id,property_id,project_id);

create table oj_private.oj_commercial_project_link_commands(
 organization_id uuid not null,
 command_id uuid not null,
 project_id uuid not null,
 expected_revision integer not null check(expected_revision>=0),
 resulting_revision integer not null check(resulting_revision>0),
 account_id uuid,
 property_id uuid,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,command_id),
 foreign key(organization_id,project_id)
  references public.oj_commercial_project_links(organization_id,project_id) on delete restrict,
 check ((account_id is null and property_id is null)
   or (account_id is not null and property_id is not null))
);
create function oj_private.oj_commercial_link_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Commercial project link command history is immutable' using errcode='23514';
end;$$;
create trigger oj_commercial_link_commands_immutable
before update or delete on oj_private.oj_commercial_project_link_commands
for each row execute function oj_private.oj_commercial_link_immutable();

alter table public.oj_commercial_project_links enable row level security;
alter table oj_private.oj_commercial_project_link_commands enable row level security;
revoke all on public.oj_commercial_project_links,oj_private.oj_commercial_project_link_commands
 from public,anon,authenticated;
revoke all on function oj_private.oj_commercial_link_immutable() from public,anon,authenticated;

create function public.oj_commercial_project_link_get(
 p_organization_id uuid,p_project_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.oj_commercial_project_links%rowtype;
begin
 if auth.uid() is null or
   coalesce(oj_private.member_role(p_organization_id),'') not in ('owner','member') then
  raise exception 'Company membership required' using errcode='42501';
 end if;
 select * into v from public.oj_commercial_project_links
  where organization_id=p_organization_id and project_id=p_project_id;
 if not found then return null; end if;
 return jsonb_build_object('accountId',v.account_id,'propertyId',v.property_id,
  'revision',v.revision,'updatedAt',v.updated_at);
end;$$;
revoke all on function public.oj_commercial_project_link_get(uuid,uuid) from public,anon;
grant execute on function public.oj_commercial_project_link_get(uuid,uuid) to authenticated;

create function public.oj_commercial_account_projects(
 p_organization_id uuid,p_account_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or
   coalesce(oj_private.member_role(p_organization_id),'') not in ('owner','member') then
  raise exception 'Company membership required' using errcode='42501';
 end if;
 if not exists(select 1 from public.oj_commercial_accounts
  where organization_id=p_organization_id and id=p_account_id) then
  raise exception 'Company account not accessible' using errcode='42501';
 end if;
 return jsonb_build_object(
  'projects',coalesce((
   select jsonb_agg(jsonb_build_object('projectId',x.project_id,
    'title',x.title,'phase',x.phase,'propertyId',x.property_id,
    'linkRevision',x.revision) order by x.project_id)
   from (
    select l.project_id,p.title,p.phase,l.property_id,l.revision
    from public.oj_commercial_project_links l
    join public.oj_commercial_projects p
      on p.organization_id=l.organization_id and p.id=l.project_id
    where l.organization_id=p_organization_id and l.account_id=p_account_id
    order by l.project_id limit 100
   ) x
  ),'[]'::jsonb),
  'hasMore',(select count(*)>100 from public.oj_commercial_project_links
   where organization_id=p_organization_id and account_id=p_account_id)
 );
end;$$;
revoke all on function public.oj_commercial_account_projects(uuid,uuid) from public,anon;
grant execute on function public.oj_commercial_account_projects(uuid,uuid) to authenticated;

create function public.oj_commercial_project_link_save(
 p_organization_id uuid,p_project_id uuid,p_expected_revision integer,
 p_command_id uuid,p_account_id uuid,p_property_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();
 v_previous oj_private.oj_commercial_project_link_commands%rowtype;
 v_old integer;
 v_new integer;
begin
 if v_actor is null or
   coalesce(oj_private.member_role(p_organization_id),'') not in ('owner','member') then
  raise exception 'Company membership required' using errcode='42501';
 end if;
 if p_organization_id is null or p_project_id is null or p_command_id is null
   or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>10000000
   or (p_account_id is null) <> (p_property_id is null) then
  raise exception 'Invalid project account association' using errcode='22023';
 end if;
 select * into v_previous from oj_private.oj_commercial_project_link_commands
  where organization_id=p_organization_id and command_id=p_command_id;
 if found then
  if v_previous.project_id<>p_project_id or
    v_previous.expected_revision<>p_expected_revision or
    v_previous.account_id is distinct from p_account_id or
    v_previous.property_id is distinct from p_property_id then
   raise exception 'Save command does not match original link' using errcode='23505';
  end if;
  return jsonb_build_object('ok',true,'replayed',true,'revision',v_previous.resulting_revision);
 end if;
 if not exists(select 1 from public.oj_commercial_projects
   where organization_id=p_organization_id and id=p_project_id) then
  raise exception 'Saved commercial project is not available' using errcode='22023';
 end if;
 if p_account_id is not null and not exists(
  select 1 from public.oj_commercial_properties x
  where x.organization_id=p_organization_id and x.account_id=p_account_id and x.id=p_property_id
 ) then
  raise exception 'Selected property is not part of this company' using errcode='22023';
 end if;
 if p_expected_revision=0 then
  if p_account_id is null then
   raise exception 'No project link exists to detach' using errcode='22023';
  end if;
  insert into public.oj_commercial_project_links(
   organization_id,project_id,account_id,property_id,revision,updated_by
  ) values(p_organization_id,p_project_id,p_account_id,p_property_id,1,v_actor)
   on conflict(organization_id,project_id) do nothing returning revision into v_new;
  if v_new is null then
   select revision into v_old from public.oj_commercial_project_links
    where organization_id=p_organization_id and project_id=p_project_id;
   return jsonb_build_object('ok',false,'conflict',true,'currentRevision',coalesce(v_old,0));
  end if;
 else
  select revision into v_old from public.oj_commercial_project_links
   where organization_id=p_organization_id and project_id=p_project_id for update;
  if v_old is distinct from p_expected_revision then
   return jsonb_build_object('ok',false,'conflict',true,'currentRevision',coalesce(v_old,0));
  end if;
  update public.oj_commercial_project_links set
    account_id=p_account_id,property_id=p_property_id,
    revision=v_old+1,updated_by=v_actor,updated_at=clock_timestamp()
   where organization_id=p_organization_id and project_id=p_project_id
   returning revision into v_new;
 end if;
 insert into oj_private.oj_commercial_project_link_commands(
  organization_id,command_id,project_id,expected_revision,resulting_revision,
  account_id,property_id,actor_id
 ) values (p_organization_id,p_command_id,p_project_id,p_expected_revision,v_new,
  p_account_id,p_property_id,v_actor);
 return jsonb_build_object('ok',true,'replayed',false,'revision',v_new);
end;$$;
revoke all on function public.oj_commercial_project_link_save(uuid,uuid,integer,uuid,uuid,uuid) from public,anon;
grant execute on function public.oj_commercial_project_link_save(uuid,uuid,integer,uuid,uuid,uuid) to authenticated;
