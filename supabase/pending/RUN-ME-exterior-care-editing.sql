-- ============================================================================
-- OJ Workspace: Exterior Care editing. NOT APPLIED YET.
--
-- What it does, for signed-in workspace owners and members only:
--   - add, edit and remove leads, bookings and door-knocking sessions
--     (new lead, status changes, payments, booking, moving and cancelling
--     jobs, sheet sync, merging duplicates);
--   - move texts from one lead to another when duplicates are merged;
--   - add to the activity history (it can never be edited or removed);
--   - read and save the Exterior Care settings (business details, sheet
--     links, texting and alert options, monthly goal).
--
-- What it does not do: nothing for viewers or signed-out visitors, texts are
-- still only written by the Exterior Care server, and the settings table itself
-- stays closed (only the named settings go through two checked functions).
--
-- How to run it: Supabase dashboard -> project "OJ EXTERIOR CARE LEADS" ->
-- SQL Editor -> paste this whole file -> Run. Once only.
--
-- To undo: drop the oj_member_add / oj_member_change / oj_member_remove
-- policies on leads, bookings, doorknocking_sessions, conversations and
-- activity_log; revoke insert, update, delete on those tables from
-- authenticated; drop function public.oj_set_exterior_settings(jsonb).
-- ============================================================================
begin;

-- Desired state: workspace owners and members can run Exterior Care from the
-- workspace, not just read it. Apply after exterior-read.sql and exterior-extras.sql.
--
-- Owners and members may add, change and remove leads, bookings and
-- door-knocking sessions; move a lead's texts to another lead (used when
-- duplicates are merged); and add to the activity history. Texts themselves are
-- still only written by the Exterior Care server, and the activity history can
-- be added to but never edited or removed. Viewers and signed-out visitors get
-- nothing. The settings table stays closed; a named list of settings is read
-- and saved through two functions.

grant insert, update, delete on public.leads, public.bookings, public.doorknocking_sessions to authenticated;
grant update on public.conversations to authenticated;
grant insert on public.activity_log to authenticated;

create policy oj_member_add on public.leads for insert to authenticated with check ((select oj_private.exterior_reader()));
create policy oj_member_change on public.leads for update to authenticated using ((select oj_private.exterior_reader())) with check ((select oj_private.exterior_reader()));
create policy oj_member_remove on public.leads for delete to authenticated using ((select oj_private.exterior_reader()));

create policy oj_member_add on public.bookings for insert to authenticated with check ((select oj_private.exterior_reader()));
create policy oj_member_change on public.bookings for update to authenticated using ((select oj_private.exterior_reader())) with check ((select oj_private.exterior_reader()));
create policy oj_member_remove on public.bookings for delete to authenticated using ((select oj_private.exterior_reader()));

create policy oj_member_add on public.doorknocking_sessions for insert to authenticated with check ((select oj_private.exterior_reader()));
create policy oj_member_change on public.doorknocking_sessions for update to authenticated using ((select oj_private.exterior_reader())) with check ((select oj_private.exterior_reader()));
create policy oj_member_remove on public.doorknocking_sessions for delete to authenticated using ((select oj_private.exterior_reader()));

create policy oj_member_change on public.conversations for update to authenticated using ((select oj_private.exterior_reader())) with check ((select oj_private.exterior_reader()));
create policy oj_member_add on public.activity_log for insert to authenticated with check ((select oj_private.exterior_reader()));

-- The settings the workspace shows. Replaces the two-setting version.
create or replace function public.oj_exterior_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when oj_private.exterior_reader() then
    (select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) from public.settings s
     where s.key in ('upgrades_completed', 'monthlyRevenueGoal', 'businessName', 'ownerPhone', 'ownerEmail', 'address', 'timezone',
                     'googleSheetUrl', 'google_sheet_url', 'd2dSheetUrl', 'maxFollowUps', 'aiStyle', 'notifyOnBooking', 'notifyOnReply', 'dailySummary'))
  end
$$;

-- Saves any of the named settings. Each value must be text of a sensible length.
create function public.oj_set_exterior_settings(changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  if not oj_private.exterior_reader() then
    raise exception 'Only workspace owners and members can change settings.' using errcode = '42501';
  end if;
  if changes is null or jsonb_typeof(changes) <> 'object' or exists (
    select 1 from jsonb_each(changes) e
    where e.key not in ('monthlyRevenueGoal', 'businessName', 'ownerPhone', 'ownerEmail', 'address', 'timezone',
                        'googleSheetUrl', 'google_sheet_url', 'd2dSheetUrl', 'maxFollowUps', 'aiStyle', 'notifyOnBooking', 'notifyOnReply', 'dailySummary')
       or jsonb_typeof(e.value) <> 'string' or length(e.value #>> '{}') > 2000) then
    raise exception 'Unknown setting or invalid value.' using errcode = '22023';
  end if;
  for item in select e.key, e.value #>> '{}' as value from jsonb_each(changes) e loop
    update public.settings set value = item.value, updated_at = now() where key = item.key;
    if not found then
      insert into public.settings(key, value) values (item.key, item.value);
    end if;
  end loop;
end $$;
revoke all on function public.oj_set_exterior_settings(jsonb) from public, anon;
grant execute on function public.oj_set_exterior_settings(jsonb) to authenticated;

commit;
