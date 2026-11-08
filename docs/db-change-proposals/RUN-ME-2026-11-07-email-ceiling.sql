-- NOT APPLIED. Founder approval and verified production backup required.
-- OJ Solutions email ceiling: one inbox, permitted values 10 to 50 inclusive.
-- Run only in the confirmed OJ EXTERIOR CARE LEADS Supabase project.
-- This changes the settings ceiling and stored out-of-range values, not emails or history.
begin;
do $$
declare constraint_name text;
begin
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.oj_email_engine_settings'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%daily_cap_max%'
  loop
    execute format('alter table public.oj_email_engine_settings drop constraint %I', constraint_name);
  end loop;
end $$;
update public.oj_email_engine_settings
set daily_cap_max = least(50, greatest(10, daily_cap_max)), updated_at = now()
where daily_cap_max < 10 or daily_cap_max > 50;
alter table public.oj_email_engine_settings
add constraint oj_email_engine_settings_daily_cap_max_check check (daily_cap_max between 10 and 50);
create or replace function public.oj_set_email_engine(
 p_organization_id uuid, p_enabled boolean, p_daily_cap_max integer, p_niche_filter text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare niche text := nullif(btrim(coalesce(p_niche_filter, '')), '');
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_organization_id),'') not in ('owner','member')
    then raise exception 'Workspace member access required'; end if;
  if p_enabled is null then raise exception 'Choose on or off'; end if;
  if p_daily_cap_max is null or p_daily_cap_max < 10 or p_daily_cap_max > 50
    then raise exception 'Daily ceiling must be from 10 to 50'; end if;
  if niche is not null and length(niche) > 80 then raise exception 'Niche is too long'; end if;
  insert into public.oj_email_engine_settings(organization_id, enabled, daily_cap_max, niche_filter, updated_by)
    values (p_organization_id,p_enabled,p_daily_cap_max,niche,auth.uid())
    on conflict (organization_id) do update
      set enabled = excluded.enabled,daily_cap_max = excluded.daily_cap_max,
          niche_filter = excluded.niche_filter,updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('enabled',p_enabled,'daily_cap_max',p_daily_cap_max,'niche_filter',niche);
end $$;
revoke all on function public.oj_set_email_engine(uuid,boolean,integer,text) from public,anon;
grant execute on function public.oj_set_email_engine(uuid,boolean,integer,text) to authenticated;
commit;
