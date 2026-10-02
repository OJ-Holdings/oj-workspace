-- Desired additional schema for the independent OJ project. Apply after workspace.sql.
-- Tokens are random 256-bit values; only SHA-256 digests are stored.
create table oj_private.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  email text not null check (length(email) between 3 and 254),
  role text not null check (role in ('member','viewer')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);
create index oj_invitations_org on oj_private.invitations(organization_id,created_at);
alter table oj_private.invitations enable row level security;
revoke all on oj_private.invitations from public,anon,authenticated;

create function public.oj_create_invitation(org uuid, email_address text, invited_role text, digest text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  if email_address is null or length(email_address) > 254 or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or invited_role is null or invited_role not in ('member','viewer') or digest is null or digest !~ '^[a-f0-9]{64}$'
  then raise exception 'Invalid invitation'; end if;
  -- Serialize invitations per organization so concurrent requests cannot evade limits.
  perform 1 from public.oj_organizations where id=org for update;
  if (select count(*) from oj_private.invitations where organization_id=org and created_at > now()-interval '1 hour') >= 10 then raise exception 'Invitation limit reached'; end if;
  update oj_private.invitations set revoked_at=now() where organization_id=org and email=lower(btrim(email_address)) and accepted_at is null and revoked_at is null;
  insert into oj_private.invitations(organization_id,email,role,token_hash,created_by)
  values(org,lower(btrim(email_address)),invited_role,digest,auth.uid()) returning id into result;
  return result;
end $$;

create function public.oj_list_invitations(org uuid)
returns table(id uuid,email text,role text,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz,accepted_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  return query select i.id,i.email,i.role,i.created_at,i.expires_at,i.revoked_at,i.accepted_at
  from oj_private.invitations i where i.organization_id=org order by i.created_at desc limit 50;
end $$;

create function public.oj_revoke_invitation(org uuid, invitation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  update oj_private.invitations set revoked_at=now() where organization_id=org and id=invitation_id and accepted_at is null and revoked_at is null;
end $$;

create function public.oj_accept_invitation(token text, display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation oj_private.invitations%rowtype; verified_email text;
begin
  if auth.uid() is null or token is null or token !~ '^[a-f0-9]{64}$' or display_name is null or length(btrim(display_name)) not between 1 and 120 then raise exception 'Invalid invitation'; end if;
  -- Email comes from verified Auth storage, never user-editable JWT metadata or caller input.
  select lower(u.email) into verified_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verify your account email first'; end if;
  select * into invitation from oj_private.invitations i where i.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
  if not found or invitation.revoked_at is not null or invitation.accepted_at is not null or invitation.expires_at <= now() or invitation.email is distinct from verified_email then raise exception 'Invitation is unavailable'; end if;
  -- An invitation loses authority if its issuer is no longer an owner.
  if not exists(select 1 from public.oj_memberships m where m.organization_id=invitation.organization_id and m.user_id=invitation.created_by and m.role='owner') then raise exception 'Invitation is unavailable'; end if;
  insert into public.oj_memberships(organization_id,user_id,role,display_name)
  values(invitation.organization_id,auth.uid(),invitation.role,btrim(display_name))
  on conflict (organization_id,user_id) do nothing;
  update oj_private.invitations set accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;
  return invitation.organization_id;
end $$;

-- Anonymous signup can check a high-entropy link plus its intended email, without retrieving records.
create function public.oj_validate_invitation(token text, email_address text) returns boolean
language sql stable security definer set search_path = '' as $$
  select token ~ '^[a-f0-9]{64}$' and exists (
    select 1 from oj_private.invitations i
    join public.oj_memberships m on m.organization_id=i.organization_id and m.user_id=i.created_by and m.role='owner'
    where i.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex')
      and i.email=lower(btrim(email_address)) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  )
$$;
revoke all on function public.oj_validate_invitation(text,text) from public;
grant execute on function public.oj_validate_invitation(text,text) to anon,authenticated;

create function public.oj_manage_member(org uuid, target_user uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare target_role text; target_name text;
begin
  if auth.uid() is null or oj_private.member_role(org) is distinct from 'owner' then raise exception 'Owner access required'; end if;
  if new_role is null or new_role not in ('member','viewer','remove') then raise exception 'Invalid role'; end if;
  select role,display_name into target_role,target_name from public.oj_memberships where organization_id=org and user_id=target_user for update;
  if not found or target_role='owner' or target_user=auth.uid() then raise exception 'Owner accounts cannot be changed here'; end if;
  if new_role='remove' then
    update public.oj_cards set assignee='' where organization_id=org and assignee=target_name;
    delete from public.oj_memberships where organization_id=org and user_id=target_user;
    -- Revoke unaccepted invitations for this verified email, preventing an old link from restoring access.
    update oj_private.invitations set revoked_at=now() where organization_id=org and accepted_at is null and email=(select lower(email) from auth.users where id=target_user);
  else
    update public.oj_memberships set role=new_role where organization_id=org and user_id=target_user;
  end if;
end $$;

revoke all on function public.oj_create_invitation(uuid,text,text,text), public.oj_list_invitations(uuid), public.oj_revoke_invitation(uuid,uuid), public.oj_accept_invitation(text,text), public.oj_manage_member(uuid,uuid,text) from public,anon;
grant execute on function public.oj_create_invitation(uuid,text,text,text), public.oj_list_invitations(uuid), public.oj_revoke_invitation(uuid,uuid), public.oj_accept_invitation(text,text), public.oj_manage_member(uuid,uuid,text) to authenticated;

-- Publish only workspace records. Invitations and authentication records are never published.
-- Conditional keeps isolated test databases usable; Supabase provides this publication.
do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['oj_cards','oj_comments','oj_activity','oj_memberships'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end $$;
