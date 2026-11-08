-- NOT APPLIED. Oscar must review against the live schema and verify a restorable production backup.
-- Apply AFTER RUN-ME-2026-11-07-email-ceiling.sql.
-- Replaces dangerous automatic Gmail Sent reconciliation with an authenticated manual review queue.
-- No email is sent or reservation deleted by this migration.
-- The member explicitly confirms Sent or Releases after checking the correct Gmail Sent mailbox.
begin;

do $$
declare constraint_name text;
begin
  if to_regclass('public.oj_email_events') is null then
    raise exception 'Email engine events table is not installed in this database';
  end if;
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.oj_email_events'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.oj_email_events drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.oj_email_events add constraint oj_email_events_kind_check
  check(kind in ('reserved','sent','failed','reply','bounce','stop','needs_review','released'));

-- Mark reservations older than 30 minutes, but never ones with an already-confirmed send or reply.
create or replace function public.oj_list_email_reservation_reviews(p_org uuid)
returns table(prospect_id uuid, recipient text, business_name text, reserved_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org),'') not in ('owner','member') then
    raise exception 'Workspace member access required';
  end if;
  update public.oj_email_events e set kind='needs_review'
    where e.organization_id=p_org and e.kind='reserved'
      and e.event_at < now() - interval '30 minutes'
      and not exists (select 1 from public.oj_email_events confirmed
        where confirmed.organization_id=e.organization_id and confirmed.prospect_id=e.prospect_id
          and confirmed.kind in ('sent','reply','stop','bounce'));
  return query
    select e.prospect_id, coalesce(p.email,''), p.business_name, e.event_at
    from public.oj_email_events e join public.oj_outreach_prospects p
      on p.organization_id=e.organization_id and p.id=e.prospect_id
    where e.organization_id=p_org and e.kind='needs_review'
    order by e.event_at asc limit 300;
end $$;

create or replace function public.oj_decide_email_reservation(p_org uuid,p_prospect uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare claim public.oj_email_events%rowtype; p public.oj_outreach_prospects%rowtype; prior text; target text;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org),'') not in ('owner','member') then
    raise exception 'Workspace member access required';
  end if;
  if p_decision not in ('sent','release') then raise exception 'Choose sent or release'; end if;
  select * into claim from public.oj_email_events
    where organization_id=p_org and prospect_id=p_prospect and kind='needs_review'
    order by event_at desc limit 1 for update;
  if not found then raise exception 'This reservation is not pending manual review'; end if;
  select * into p from public.oj_outreach_prospects
    where organization_id=p_org and id=p_prospect for update;
  if not found then raise exception 'The prospect no longer exists'; end if;
  if exists(select 1 from public.oj_email_events where organization_id=p_org
    and prospect_id=p_prospect and kind in ('sent','reply','stop','bounce')) then
    raise exception 'This contact already has a delivery or response record. Review manually before changes';
  end if;
  if p_decision='release' then
    if coalesce(p.outreach_status,p.source_status) not in ('Not Sent','DMed') then
      raise exception 'Prospect is already marked contacted; do not release';
    end if;
    -- Change status AND dedupe key. This frees reserve:<id> without DELETE privilege.
    update public.oj_email_events set kind='released',
      dedupe_key='released:'||claim.id::text,
      detail='Manually released by workspace member'
      where id=claim.id and organization_id=p_org;
    return jsonb_build_object('ok',true,'decision','released');
  end if;
  -- Preserve the original reservation time because the actual Gmail send time is unknown.
  update public.oj_email_events set kind='sent',dedupe_key='sent:'||p_prospect::text,
    detail='Confirmed in Gmail Sent by workspace member; actual send time unverified'
    where id=claim.id and organization_id=p_org;
  prior:=coalesce(p.outreach_status,p.source_status);
  target:=case prior when 'Not Sent' then 'Emailed' when 'DMed' then 'Emailed + DMed' else null end;
  if target is not null then
    update public.oj_outreach_prospects set outreach_status=target,status_updated_at=now(),updated_at=now()
      where organization_id=p_org and id=p_prospect;
    insert into public.oj_outreach_activity(organization_id,prospect_id,actor_id,previous_status,new_status)
      values(p_org,p_prospect,auth.uid(),prior,target);
  end if;
  return jsonb_build_object('ok',true,'decision','sent');
end $$;

revoke all on function public.oj_list_email_reservation_reviews(uuid) from public,anon;
revoke all on function public.oj_decide_email_reservation(uuid,uuid,text) from public,anon;
grant execute on function public.oj_list_email_reservation_reviews(uuid) to authenticated;
grant execute on function public.oj_decide_email_reservation(uuid,uuid,text) to authenticated;
commit;
