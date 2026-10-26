-- STAGED U2 ONLY. DO NOT RUN AGAINST PRODUCTION without new migration approval,
-- recoverable Storage-byte archives, actor tests, and current deployment parity.
-- A B2B commercial account is NOT an inferred legacy customer/booking match.
-- No customer messaging, invoicing, project approval, or logo upload is included.
create schema if not exists oj_private;
create table public.oj_commercial_accounts (
 organization_id uuid not null references public.oj_organizations(id) on delete restrict,
 id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 160),
 industry text not null default '' check(length(industry)<=80),
 website text not null default '' check(length(website)<=240),
 notes text not null default '' check(length(notes)<=2000),
 revision integer not null default 1 check(revision>0),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,id)
);
create index oj_commercial_accounts_recent on public.oj_commercial_accounts(organization_id,updated_at desc,id);
create table public.oj_commercial_contacts (
 organization_id uuid not null,
 account_id uuid not null,
 id uuid not null,
 full_name text not null check(length(btrim(full_name)) between 1 and 120),
 role text not null default '' check(length(role)<=80),
 email text not null default '' check(length(email)<=180),
 phone text not null default '' check(length(phone)<=60),
 primary key(organization_id,account_id,id),
 foreign key(organization_id,account_id) references public.oj_commercial_accounts(organization_id,id) on delete restrict
);
create table public.oj_commercial_properties (
 organization_id uuid not null,
 account_id uuid not null,
 id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 120),
 address text not null default '' check(length(address)<=300),
 service_notes text not null default '' check(length(service_notes)<=2000),
 frequency text not null default 'unknown' check(frequency in ('unknown','one-time','monthly','quarterly','annual')),
 primary key(organization_id,account_id,id),
 foreign key(organization_id,account_id) references public.oj_commercial_accounts(organization_id,id) on delete restrict
);
create table oj_private.oj_commercial_account_commands(
 organization_id uuid not null,
 command_id uuid not null,
 account_id uuid not null,
 expected_revision integer not null check(expected_revision>=0),
 resulting_revision integer not null check(resulting_revision>0),
 payload jsonb not null,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,command_id),
 foreign key(organization_id,account_id) references public.oj_commercial_accounts(organization_id,id) on delete restrict
);
create function oj_private.oj_commercial_account_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Company save receipts are immutable' using errcode='23514';
end;$$;
create trigger oj_commercial_account_commands_immutable
before update or delete on oj_private.oj_commercial_account_commands
for each row execute function oj_private.oj_commercial_account_immutable();
alter table public.oj_commercial_accounts enable row level security;
alter table public.oj_commercial_contacts enable row level security;
alter table public.oj_commercial_properties enable row level security;
alter table oj_private.oj_commercial_account_commands enable row level security;
revoke all on public.oj_commercial_accounts,public.oj_commercial_contacts,
 public.oj_commercial_properties,oj_private.oj_commercial_account_commands from public,anon,authenticated;
revoke all on function oj_private.oj_commercial_account_immutable() from public,anon,authenticated;

-- Read all data of the requested company ONLY, never a cross-company directory.
create function public.oj_commercial_accounts_list(p_organization_id uuid,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or
   coalesce(oj_private.member_role(p_organization_id),'') not in ('owner','member') then
  raise exception 'Company membership required' using errcode='42501';
 end if;
 if p_limit is null or p_limit<1 or p_limit>50 then
  raise exception 'Invalid page limit' using errcode='22023';
 end if;
 return jsonb_build_object(
  'accounts',coalesce((
    select jsonb_agg(to_jsonb(row) order by row."updatedAt" desc,row.id) from (
      select a.id,a.name,a.industry,a.website,a.notes,a.revision,
        a.created_at as "createdAt",a.updated_at as "updatedAt",
        coalesce((select jsonb_agg(jsonb_build_object(
          'id',c.id,'fullName',c.full_name,'role',c.role,'email',c.email,'phone',c.phone
        ) order by c.full_name,c.id)
          from public.oj_commercial_contacts c
          where c.organization_id=a.organization_id and c.account_id=a.id),'[]'::jsonb) as contacts,
        coalesce((select jsonb_agg(jsonb_build_object(
          'id',p.id,'name',p.name,'address',p.address,
          'serviceNotes',p.service_notes,'frequency',p.frequency
        ) order by p.name,p.id)
          from public.oj_commercial_properties p
          where p.organization_id=a.organization_id and p.account_id=a.id),'[]'::jsonb) as properties
      from public.oj_commercial_accounts a
      where a.organization_id=p_organization_id
      order by a.updated_at desc,a.id limit p_limit
    ) row
  ),'[]'::jsonb),
  'hasMore',(select count(*)>p_limit from public.oj_commercial_accounts where organization_id=p_organization_id)
 );
end;$$;
revoke all on function public.oj_commercial_accounts_list(uuid,integer) from public,anon;
grant execute on function public.oj_commercial_accounts_list(uuid,integer) to authenticated;

-- All-or-nothing revisioned save. Child entries are upserted; omission NEVER
-- deletes an existing contact or property. No silent destructive bulk overwrite.
create function public.oj_commercial_account_save(
 p_organization_id uuid,p_account_id uuid,p_expected_revision integer,
 p_command_id uuid,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();
 v_prev oj_private.oj_commercial_account_commands%rowtype;
 v_current integer;
 v_revision integer;
 v_child jsonb;
 v_seen text[];
begin
 if v_actor is null or coalesce(oj_private.member_role(p_organization_id),'') not in ('owner','member') then
  raise exception 'Company membership required' using errcode='42501';
 end if;
 if p_organization_id is null or p_account_id is null or p_command_id is null or
   p_expected_revision is null or p_expected_revision<0 or p_expected_revision>10000000 or
   jsonb_typeof(p_payload) is distinct from 'object' or
   octet_length(p_payload::text)>60000 or
   jsonb_typeof(p_payload->'name') is distinct from 'string' or
   length(btrim(p_payload->>'name')) not between 1 and 160 or
   jsonb_typeof(p_payload->'industry') is distinct from 'string' or
   length(p_payload->>'industry')>80 or
   jsonb_typeof(p_payload->'website') is distinct from 'string' or
   length(p_payload->>'website')>240 or
   jsonb_typeof(p_payload->'notes') is distinct from 'string' or
   length(p_payload->>'notes')>2000 or
   jsonb_typeof(p_payload->'contacts') is distinct from 'array' or
   jsonb_typeof(p_payload->'properties') is distinct from 'array' or
   jsonb_array_length(p_payload->'contacts')>20 or
   jsonb_array_length(p_payload->'properties')>30 then
  raise exception 'Invalid company profile' using errcode='22023';
 end if;
 select * into v_prev from oj_private.oj_commercial_account_commands
  where organization_id=p_organization_id and command_id=p_command_id;
 if found then
  if v_prev.account_id<>p_account_id or v_prev.expected_revision<>p_expected_revision
    or v_prev.payload<>p_payload then
   raise exception 'Original command ID is bound to different company data' using errcode='23505';
  end if;
  return jsonb_build_object('ok',true,'revision',v_prev.resulting_revision,'replayed',true);
 end if;
 -- Validate the entire input BEFORE writing the parent or a child.
 v_seen:=array[]::text[];
 for v_child in select value from jsonb_array_elements(p_payload->'contacts') loop
  if jsonb_typeof(v_child) is distinct from 'object' then
   raise exception 'Invalid company contact object' using errcode='22023';
  end if;
  if coalesce((v_child->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false)=false then
   raise exception 'Invalid company contact ID' using errcode='22023';
  end if;
  if jsonb_typeof(v_child->'fullName') is distinct from 'string'
     or length(btrim(v_child->>'fullName')) not between 1 and 120 then
   raise exception 'Invalid company contact name' using errcode='22023';
  end if;
  if jsonb_typeof(v_child->'role') is distinct from 'string'
     or length(v_child->>'role')>80 then
   raise exception 'Invalid company contact role' using errcode='22023';
  end if;
  if jsonb_typeof(v_child->'email') is distinct from 'string'
     or length(v_child->>'email')>180 then
   raise exception 'Invalid company contact email' using errcode='22023';
  end if;
  if jsonb_typeof(v_child->'phone') is distinct from 'string'
     or length(v_child->>'phone')>60 then
   raise exception 'Invalid company contact phone' using errcode='22023';
  end if;
  if (v_child->>'id')=any(v_seen) then
   raise exception 'Duplicate company contact ID' using errcode='22023';
  end if;
  v_seen:=array_append(v_seen,v_child->>'id');
 end loop;
 v_seen:=array[]::text[];
 for v_child in select value from jsonb_array_elements(p_payload->'properties') loop
  if jsonb_typeof(v_child) is distinct from 'object' or
    (v_child->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
    jsonb_typeof(v_child->'name') is distinct from 'string' or
    length(btrim(v_child->>'name')) not between 1 and 120 or
    jsonb_typeof(v_child->'address') is distinct from 'string' or length(v_child->>'address')>300 or
    jsonb_typeof(v_child->'serviceNotes') is distinct from 'string' or length(v_child->>'serviceNotes')>2000 or
    coalesce(v_child->>'frequency','') not in ('unknown','one-time','monthly','quarterly','annual') then
   raise exception 'Invalid company property' using errcode='22023';
  end if;
  if (v_child->>'id')=any(v_seen) then
   raise exception 'Duplicate company property ID' using errcode='22023';
  end if;
  v_seen:=array_append(v_seen,v_child->>'id');
 end loop;
 if p_expected_revision=0 then
  insert into public.oj_commercial_accounts (
   organization_id,id,name,industry,website,notes,revision,created_by,updated_by)
  values (p_organization_id,p_account_id,btrim(p_payload->>'name'),
   p_payload->>'industry',p_payload->>'website',p_payload->>'notes',1,v_actor,v_actor)
  on conflict(organization_id,id) do nothing returning revision into v_revision;
  if v_revision is null then
   select revision into v_current from public.oj_commercial_accounts
     where organization_id=p_organization_id and id=p_account_id;
   return jsonb_build_object('ok',false,'conflict',true,'currentRevision',coalesce(v_current,0));
  end if;
 else
  select revision into v_current from public.oj_commercial_accounts
   where organization_id=p_organization_id and id=p_account_id for update;
  if v_current is distinct from p_expected_revision then
   return jsonb_build_object('ok',false,'conflict',true,'currentRevision',coalesce(v_current,0));
  end if;
  update public.oj_commercial_accounts set
   name=btrim(p_payload->>'name'),industry=p_payload->>'industry',
   website=p_payload->>'website',notes=p_payload->>'notes',
   updated_by=v_actor,updated_at=clock_timestamp(),revision=v_current+1
   where organization_id=p_organization_id and id=p_account_id
   returning revision into v_revision;
 end if;
 for v_child in select value from jsonb_array_elements(p_payload->'contacts') loop
  insert into public.oj_commercial_contacts(
   organization_id,account_id,id,full_name,role,email,phone
  ) values(p_organization_id,p_account_id,(v_child->>'id')::uuid,
   btrim(v_child->>'fullName'),v_child->>'role',v_child->>'email',v_child->>'phone')
  on conflict(organization_id,account_id,id) do update set
   full_name=excluded.full_name,role=excluded.role,email=excluded.email,phone=excluded.phone;
 end loop;
 for v_child in select value from jsonb_array_elements(p_payload->'properties') loop
  insert into public.oj_commercial_properties(
   organization_id,account_id,id,name,address,service_notes,frequency
  ) values(p_organization_id,p_account_id,(v_child->>'id')::uuid,
   btrim(v_child->>'name'),v_child->>'address',v_child->>'serviceNotes',v_child->>'frequency')
  on conflict(organization_id,account_id,id) do update set
   name=excluded.name,address=excluded.address,service_notes=excluded.service_notes,
   frequency=excluded.frequency;
 end loop;
 insert into oj_private.oj_commercial_account_commands(
  organization_id,command_id,account_id,expected_revision,resulting_revision,payload,actor_id
 ) values(p_organization_id,p_command_id,p_account_id,p_expected_revision,v_revision,p_payload,v_actor);
 return jsonb_build_object('ok',true,'revision',v_revision,'replayed',false);
end;$$;
revoke all on function public.oj_commercial_account_save(uuid,uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.oj_commercial_account_save(uuid,uuid,integer,uuid,jsonb) to authenticated;
