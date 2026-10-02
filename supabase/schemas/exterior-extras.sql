-- Desired state: the rest of the Exterior Care records the workspace shows.
-- Apply after exterior-read.sql.
--
-- 1. Website quote requests become readable by workspace owners and members.
-- 2. Two named settings (the monthly revenue goal and the upgrades checklist)
--    become readable through a function. The settings table itself stays closed:
--    it also holds a phone number and private spreadsheet links.
-- 3. Owners and members may save the upgrades checklist, and nothing else in
--    settings, through a function that checks the value's shape. The old
--    Exterior Care app reads the same row, so both stay in step.

grant select on public.quote_requests to authenticated;
create policy oj_member_read on public.quote_requests for select to authenticated using ((select oj_private.exterior_reader()));

create function public.oj_exterior_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when oj_private.exterior_reader() then
    (select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb) from public.settings s where s.key in ('upgrades_completed', 'monthlyRevenueGoal'))
  end
$$;
revoke all on function public.oj_exterior_settings() from public, anon;
grant execute on function public.oj_exterior_settings() to authenticated;

create function public.oj_set_exterior_upgrades(completed jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not oj_private.exterior_reader() then
    raise exception 'Only workspace owners and members can change upgrades.' using errcode = '42501';
  end if;
  if completed is null or jsonb_typeof(completed) <> 'object'
    or (select count(*) from jsonb_each(completed)) > 300
    or exists (select 1 from jsonb_each(completed) e where e.value <> 'true'::jsonb or e.key !~ '^[a-z0-9_]{1,40}$') then
    raise exception 'Upgrades must be a list of upgrade ids marked true.' using errcode = '22023';
  end if;
  update public.settings set value = completed::text, updated_at = now() where key = 'upgrades_completed';
  if not found then
    insert into public.settings(key, value) values ('upgrades_completed', completed::text);
  end if;
end $$;
revoke all on function public.oj_set_exterior_upgrades(jsonb) from public, anon;
grant execute on function public.oj_set_exterior_upgrades(jsonb) to authenticated;
