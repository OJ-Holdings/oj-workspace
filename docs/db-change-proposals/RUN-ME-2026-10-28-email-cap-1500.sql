-- OJ Solutions email engine: no warm-up, and a daily ceiling of up to 1,500 (Google's own limit for a Workspace account). Sets the engine to 1,500 a day.
-- The live database currently rejects anything above 50 (a check on the settings table and the limit inside oj_set_email_engine; the earlier 50 script may or may not have been run).
-- Run once in the Supabase SQL editor. Safe to run again. Changes only the cap limit and the one settings row; no emails, prospects or history are touched.
--
-- The app no longer has a warm-up ramp: the day's limit is the ceiling.
begin;

do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.oj_email_engine_settings'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%daily_cap_max%';
  if c is not null then execute format('alter table public.oj_email_engine_settings drop constraint %I', c); end if;
end $$;
alter table public.oj_email_engine_settings add constraint oj_email_engine_settings_daily_cap_max_check check (daily_cap_max between 1 and 1500);

create or replace function public.oj_set_email_engine(p_organization_id uuid, p_enabled boolean, p_daily_cap_max integer, p_niche_filter text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare niche text := nullif(btrim(coalesce(p_niche_filter, '')), '');
begin
  if auth.uid() is null or not coalesce(oj_private.member_role(p_organization_id) in ('owner','member'), false) then
    raise exception 'Workspace member access required';
  end if;
  if p_enabled is null then raise exception 'Choose on or off'; end if;
  if p_daily_cap_max is null or p_daily_cap_max < 1 or p_daily_cap_max > 1500 then raise exception 'Daily cap must be between 1 and 1500'; end if;
  if niche is not null and length(niche) > 80 then raise exception 'Niche is too long'; end if;
  insert into public.oj_email_engine_settings(organization_id, enabled, daily_cap_max, niche_filter, updated_by)
    values (p_organization_id, p_enabled, p_daily_cap_max, niche, auth.uid())
    on conflict (organization_id) do update
      set enabled = excluded.enabled, daily_cap_max = excluded.daily_cap_max,
          niche_filter = excluded.niche_filter, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('enabled', p_enabled, 'daily_cap_max', p_daily_cap_max, 'niche_filter', niche);
end $$;

-- The one existing settings row (this workspace) goes to 1500.
update public.oj_email_engine_settings set daily_cap_max = 1500, updated_at = now();

commit;
