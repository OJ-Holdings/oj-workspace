-- NOT APPLIED. Founder review, production backup and recovery verification required.
-- Adds optional four-business-day follow-ups to the OJ Solutions email engine.
-- Apply AFTER PR A's email-ceiling.sql AND email-reservation-review.sql. This PR is dependent on PR A.
begin;
alter table public.oj_email_engine_settings add column if not exists followups_enabled boolean not null default true;
do $$ declare cname text; begin
  for cname in select conname from pg_constraint where conrelid='public.oj_email_events'::regclass and contype='c'
   and pg_get_constraintdef(oid) ilike '%kind%' loop
    execute format('alter table public.oj_email_events drop constraint %I', cname);
  end loop;
end $$;
alter table public.oj_email_events add constraint oj_email_events_kind_check
  check(kind in ('reserved','sent','failed','reply','bounce','stop','needs_review','released','followup_reserved','followup_sent'));
create or replace function public.oj_set_followups_enabled(p_org uuid, p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org),'') not in ('owner','member') then
    raise exception 'Workspace member access required'; end if;
  if p_enabled is null then raise exception 'Choose on or off'; end if;
  insert into public.oj_email_engine_settings(organization_id,followups_enabled)
    values (p_org,p_enabled) on conflict(organization_id)
    do update set followups_enabled=excluded.followups_enabled, updated_by=auth.uid(),updated_at=now();
  return p_enabled;
end $$;
revoke all on function public.oj_set_followups_enabled(uuid,boolean) from public,anon;
grant execute on function public.oj_set_followups_enabled(uuid,boolean) to authenticated;
commit;
