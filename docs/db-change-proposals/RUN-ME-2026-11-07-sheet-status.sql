-- NOT APPLIED. Founder review + verified Supabase backup required.
-- Apply AFTER RUN-ME-2026-11-07-dm-skips.sql.
-- Marking a DM lead as skipped also marks its authoritative workspace status Dead,
-- so it cannot be picked for email outreach while Sheets F:G catches up.
begin;
create or replace function oj_private.record_dm_skip_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare previous text;
begin
  select coalesce(outreach_status,source_status) into previous
  from public.oj_outreach_prospects where organization_id=new.organization_id and id=new.prospect_id for update;
  if previous is not null and previous <> 'Dead' then
    update public.oj_outreach_prospects set outreach_status='Dead',status_updated_at=new.skipped_at,updated_at=new.skipped_at
     where organization_id=new.organization_id and id=new.prospect_id;
    insert into public.oj_outreach_activity(organization_id,prospect_id,actor_id,previous_status,new_status)
     values(new.organization_id,new.prospect_id,new.actor_id,previous,'Dead');
  end if;
  return new;
end $$;
drop trigger if exists oj_dm_skip_status on public.oj_outreach_skips;
create trigger oj_dm_skip_status after insert on public.oj_outreach_skips
 for each row execute function oj_private.record_dm_skip_status();
commit;
