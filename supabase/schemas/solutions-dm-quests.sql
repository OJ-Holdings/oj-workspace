-- OJ Solutions "Daily 10": the direct-message quest log and the shared goal.
--
-- Desired state. Apply after outreach-pipeline.sql (already live). NOT applied
-- to the live project: a founder reviews and applies it. Everything is additive:
-- two new tables and three functions. No existing row or table is changed.
--
-- Members cannot write the log directly. They call oj_log_dm, which records the
-- DM and, for a prospect from the list, moves the prospect's status the same
-- audited way oj_set_outreach_status does (Not Sent -> DMed, Emailed -> Emailed + DMed).
-- The day a DM counts for is set by the database in Central time, never by the caller.

create table public.oj_growth_settings (
  organization_id uuid primary key references public.oj_organizations(id),
  dm_daily_goal integer not null default 10 check (dm_daily_goal between 1 and 50),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.oj_outreach_dm_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  actor_id uuid not null references auth.users(id),
  prospect_id uuid,
  channel text not null check (channel in ('instagram','facebook','linkedin','other')),
  work_day date not null,
  previous_status text check (previous_status is null or previous_status in ('Not Sent','Emailed','DMed','Emailed + DMed','Replied','Demo Booked','Not Interested','Dead')),
  new_status text check (new_status is null or new_status in ('Not Sent','Emailed','DMed','Emailed + DMed','Replied','Demo Booked','Not Interested','Dead')),
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  check ((previous_status is null) = (new_status is null)),
  foreign key (organization_id, prospect_id) references public.oj_outreach_prospects(organization_id, id)
);
create index oj_dm_log_day on public.oj_outreach_dm_log(organization_id, work_day desc, actor_id);
create index oj_dm_log_actor on public.oj_outreach_dm_log(actor_id);
create index oj_dm_log_prospect on public.oj_outreach_dm_log(organization_id, prospect_id) where prospect_id is not null;
-- One counted DM per person per prospect per day, so a double tap cannot score twice.
create unique index oj_dm_log_once_a_day on public.oj_outreach_dm_log(organization_id, actor_id, prospect_id, work_day)
  where prospect_id is not null and undone_at is null;

alter table public.oj_growth_settings enable row level security;
alter table public.oj_outreach_dm_log enable row level security;
revoke all on public.oj_growth_settings, public.oj_outreach_dm_log from public, anon, authenticated;
grant select on public.oj_growth_settings, public.oj_outreach_dm_log to authenticated;
-- The reminder sender (a server holding the service key) reads today's counts.
grant select on public.oj_growth_settings, public.oj_outreach_dm_log to service_role;

create policy oj_growth_settings_read on public.oj_growth_settings for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy oj_dm_log_read on public.oj_outreach_dm_log for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));

create function public.oj_log_dm(p_organization_id uuid, p_prospect_id uuid, p_channel text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Chicago')::date;
  effective text; target text; existing uuid; new_id uuid; counted integer;
begin
  if auth.uid() is null or not coalesce(oj_private.member_role(p_organization_id) in ('owner','member'), false) then
    raise exception 'Workspace member access required';
  end if;
  if p_channel is null or p_channel not in ('instagram','facebook','linkedin','other') then
    raise exception 'Invalid channel';
  end if;

  if p_prospect_id is not null then
    select coalesce(p.outreach_status, p.source_status) into effective
      from public.oj_outreach_prospects p
      where p.organization_id = p_organization_id and p.id = p_prospect_id
      for update;
    if not found then raise exception 'Prospect not found'; end if;

    select l.id into existing from public.oj_outreach_dm_log l
      where l.organization_id = p_organization_id and l.actor_id = auth.uid()
        and l.prospect_id = p_prospect_id and l.work_day = today and l.undone_at is null;
    if existing is not null then
      select count(*) into counted from public.oj_outreach_dm_log l
        where l.organization_id = p_organization_id and l.actor_id = auth.uid() and l.work_day = today and l.undone_at is null;
      return jsonb_build_object('ok', true, 'duplicate', true, 'id', existing, 'today', counted);
    end if;

    target := case effective when 'Not Sent' then 'DMed' when 'Emailed' then 'Emailed + DMed' else null end;
    if target is not null then
      update public.oj_outreach_prospects
        set outreach_status = target, status_updated_at = now(), updated_at = now()
        where organization_id = p_organization_id and id = p_prospect_id;
      insert into public.oj_outreach_activity(organization_id, prospect_id, actor_id, previous_status, new_status)
        values (p_organization_id, p_prospect_id, auth.uid(), effective, target);
    end if;
  end if;

  insert into public.oj_outreach_dm_log(organization_id, actor_id, prospect_id, channel, work_day, previous_status, new_status)
    values (p_organization_id, auth.uid(), p_prospect_id, p_channel, today,
            case when target is null then null else effective end, target)
    returning id into new_id;
  select count(*) into counted from public.oj_outreach_dm_log l
    where l.organization_id = p_organization_id and l.actor_id = auth.uid() and l.work_day = today and l.undone_at is null;
  return jsonb_build_object('ok', true, 'duplicate', false, 'id', new_id, 'today', counted);
end $$;

-- A misclick can be undone by the person who made it for 15 minutes. The prospect
-- goes back only if nobody has moved it since.
create function public.oj_undo_dm(p_organization_id uuid, p_log_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.oj_outreach_dm_log; effective text; counted integer;
begin
  if auth.uid() is null or not coalesce(oj_private.member_role(p_organization_id) in ('owner','member'), false) then
    raise exception 'Workspace member access required';
  end if;
  select * into r from public.oj_outreach_dm_log l
    where l.id = p_log_id and l.organization_id = p_organization_id and l.actor_id = auth.uid()
      and l.undone_at is null and l.created_at > now() - interval '15 minutes'
    for update;
  if not found then raise exception 'Nothing to undo'; end if;
  update public.oj_outreach_dm_log set undone_at = now() where id = r.id;

  if r.prospect_id is not null and r.new_status is not null then
    select coalesce(p.outreach_status, p.source_status) into effective
      from public.oj_outreach_prospects p
      where p.organization_id = p_organization_id and p.id = r.prospect_id
      for update;
    if found and effective = r.new_status then
      update public.oj_outreach_prospects
        set outreach_status = r.previous_status, status_updated_at = now(), updated_at = now()
        where organization_id = p_organization_id and id = r.prospect_id;
      insert into public.oj_outreach_activity(organization_id, prospect_id, actor_id, previous_status, new_status)
        values (p_organization_id, r.prospect_id, auth.uid(), r.new_status, r.previous_status);
    end if;
  end if;
  select count(*) into counted from public.oj_outreach_dm_log l
    where l.organization_id = p_organization_id and l.actor_id = auth.uid() and l.work_day = r.work_day and l.undone_at is null;
  return jsonb_build_object('ok', true, 'today', counted);
end $$;

create function public.oj_set_dm_goal(p_organization_id uuid, p_goal integer)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(oj_private.member_role(p_organization_id) in ('owner','member'), false) then
    raise exception 'Workspace member access required';
  end if;
  if p_goal is null or p_goal < 1 or p_goal > 50 then raise exception 'Goal must be between 1 and 50'; end if;
  insert into public.oj_growth_settings(organization_id, dm_daily_goal, updated_by)
    values (p_organization_id, p_goal, auth.uid())
    on conflict (organization_id) do update set dm_daily_goal = excluded.dm_daily_goal, updated_by = excluded.updated_by, updated_at = now();
  return p_goal;
end $$;

revoke all on function public.oj_log_dm(uuid,uuid,text), public.oj_undo_dm(uuid,uuid), public.oj_set_dm_goal(uuid,integer) from public, anon;
grant execute on function public.oj_log_dm(uuid,uuid,text), public.oj_undo_dm(uuid,uuid), public.oj_set_dm_goal(uuid,integer) to authenticated;
