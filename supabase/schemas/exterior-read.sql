-- Desired state: workspace owners and members may READ the existing Exterior Care
-- records (leads, text conversations, bookings, door-knocking sessions, activity).
-- Apply after workspace.sql and legacy-access.sql.
--
-- Read only. Nothing here lets the workspace add, change or remove a legacy row;
-- the existing Exterior Care server (service role) remains the only writer, so its
-- Google Sheets sync and SMS follow-ups are unaffected. Viewers get no access:
-- these tables hold customers' names, phone numbers and addresses. The legacy
-- `settings` table is deliberately left out.

-- The legacy tables have no organization_id, so record which workspace owns them.
create table oj_private.legacy_owner (
  organization_id uuid primary key references public.oj_organizations(id)
);
alter table oj_private.legacy_owner enable row level security;
revoke all on oj_private.legacy_owner from public, anon, authenticated;

do $$
begin
  if (select count(*) from public.oj_organizations) <> 1 then
    raise exception 'Expected exactly one workspace to own the Exterior Care records; found %', (select count(*) from public.oj_organizations);
  end if;
  insert into oj_private.legacy_owner(organization_id) select id from public.oj_organizations;
end $$;

-- True only for a signed-in owner or member of the workspace that owns the records.
create function oj_private.exterior_reader() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from oj_private.legacy_owner o
    join public.oj_memberships m on m.organization_id = o.organization_id
    where m.user_id = (select auth.uid()) and m.role in ('owner', 'member')
  )
$$;
revoke all on function oj_private.exterior_reader() from public, anon;
grant execute on function oj_private.exterior_reader() to authenticated;

grant select on public.leads, public.conversations, public.bookings, public.doorknocking_sessions, public.activity_log to authenticated;
create policy oj_member_read on public.leads for select to authenticated using ((select oj_private.exterior_reader()));
create policy oj_member_read on public.conversations for select to authenticated using ((select oj_private.exterior_reader()));
create policy oj_member_read on public.bookings for select to authenticated using ((select oj_private.exterior_reader()));
create policy oj_member_read on public.doorknocking_sessions for select to authenticated using ((select oj_private.exterior_reader()));
create policy oj_member_read on public.activity_log for select to authenticated using ((select oj_private.exterior_reader()));
