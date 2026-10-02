-- One-time owner enrollment. Email is provisioned by the authorized project administrator.
create table oj_private.owner_setup (
  organization_id uuid primary key references public.oj_organizations(id),
  email text not null unique,
  approved_user_id uuid references auth.users(id),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id)
);
alter table oj_private.owner_setup enable row level security;
revoke all on oj_private.owner_setup from public,anon,authenticated;

create function public.oj_owner_setup_pending(email_address text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from oj_private.owner_setup where email=lower(btrim(email_address)) and claimed_at is null)
$$;
revoke all on function public.oj_owner_setup_pending(text) from public;
grant execute on function public.oj_owner_setup_pending(text) to anon,authenticated;

create function public.oj_claim_owner(display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare verified_email text; setup oj_private.owner_setup%rowtype;
begin
  if auth.uid() is null or display_name is null or length(btrim(display_name)) not between 1 and 120 then raise exception 'Verified owner identity required'; end if;
  select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verify your email first'; end if;
  select * into setup from oj_private.owner_setup where email=verified_email and claimed_at is null for update;
  if not found then raise exception 'Owner setup is unavailable'; end if;
  if setup.approved_user_id is distinct from auth.uid() then raise exception 'Administrator approval required'; end if;
  if exists(select 1 from public.oj_memberships where organization_id=setup.organization_id and role='owner') then raise exception 'Workspace already has an owner'; end if;
  insert into public.oj_memberships(organization_id,user_id,role,display_name) values(setup.organization_id,auth.uid(),'owner',btrim(display_name));
  update oj_private.owner_setup set claimed_at=now(),claimed_by=auth.uid() where organization_id=setup.organization_id;
  return setup.organization_id;
end $$;
revoke all on function public.oj_claim_owner(text) from public,anon;
grant execute on function public.oj_claim_owner(text) to authenticated;
