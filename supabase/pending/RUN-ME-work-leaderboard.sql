-- ============================================================================
-- OJ Workspace: weekly work leaderboard. NOT APPLIED. Run only with a founder's OK.
--
-- Paste this whole file into the Supabase SQL editor for the OJ project and run
-- it once. It is one transaction: if any statement fails, nothing is changed.
-- Running it a second time fails on the first statement and changes nothing.
--
-- What it does (all additive; no existing row is changed):
--   * oj_cards gains completed_by and completed_at, set by the database when a
--     card moves to Done. Cards already in Done stay blank (unknown) and never score.
--   * new table oj_work_sessions (the work timer), readable by owners and members,
--     each of whom can start and change only their own sessions.
--   * oj_close_idle_work(org) and oj_work_scores(org), the scoring source of truth.
--
-- Afterwards: move this file to supabase/applied/ with the date, and note it in
-- AGENT_LOG.md. The desired state is supabase/schemas/work-leaderboard.sql; this
-- file must keep containing it word for word (tests/work-leaderboard.test.ts).
--
-- To undo, before anyone relies on it (drops every recorded session):
--   drop function public.oj_work_scores(uuid);
--   drop function public.oj_close_idle_work(uuid);
--   drop table public.oj_work_sessions;
--   drop function oj_private.guard_work_session();
--   drop trigger stamp_card_completion on public.oj_cards;
--   drop function oj_private.stamp_card_completion();
--   alter table public.oj_cards drop column completed_by, drop column completed_at;
-- ============================================================================
begin;

-- OJ Workspace: the weekly work leaderboard for the partners.
--
-- Desired state. Apply after workspace.sql and collaboration.sql (it changes
-- oj_cards). NOT applied to the live project: the paste-ready copy is
-- supabase/pending/RUN-ME-work-leaderboard.sql, run by a founder after review.
-- Everything here is additive: one new table, two new columns on oj_cards, one
-- new trigger on oj_cards, three functions. No existing row is changed.
--
-- The partners are the workspace's owners and members. Viewers take no part:
-- they cannot read sessions or scores, and they have no timer.
--
--   1. oj_cards.completed_by / completed_at: who moved a task to Done, and when.
--   2. oj_work_sessions: one row per stretch of timed work.
--   3. oj_close_idle_work(org): ends timers nobody confirmed for 70 minutes.
--   4. oj_work_scores(org): the one place points are worked out.
--
-- Times the rules depend on (a timer's start, its check-ins, when it was
-- stopped, when a task was created or finished) are set by the database from
-- its own clock, whatever the caller sends.

-- 1. Who finished a task, and when -------------------------------------------
-- Tasks already in Done keep both empty: when they were finished, and by whom,
-- is not recorded anywhere, so they never score.
alter table public.oj_cards
  add column completed_by uuid references auth.users(id),
  add column completed_at timestamptz,
  add constraint oj_cards_completion_pair check ((completed_by is null) = (completed_at is null)),
  add constraint oj_cards_completion_done check (completed_at is null or stage = 'Done');
create index oj_cards_completed on public.oj_cards(organization_id, completed_at) where completed_at is not null;
create index oj_cards_completer on public.oj_cards(completed_by);

-- Moving a card into Done records the person who moved it and the time; moving
-- it out clears both; a card that stays in Done keeps them. A new card's
-- created_at is the moment it is inserted, so a task cannot be back-dated past
-- the 12-hour rule in oj_work_scores. Members cannot write either column
-- directly (they are not in the column grants on oj_cards).
create function oj_private.stamp_card_completion() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  end if;
  if new.stage <> 'Done' then
    new.completed_by := null; new.completed_at := null;
  elsif tg_op = 'UPDATE' and old.stage = 'Done' then
    new.completed_by := old.completed_by; new.completed_at := old.completed_at;
  elsif auth.uid() is null then
    -- Finished outside the app (the SQL editor, a backend job): unknown who did it.
    new.completed_by := null; new.completed_at := null;
  else
    new.completed_by := auth.uid(); new.completed_at := now();
  end if;
  return new;
end $$;
revoke all on function oj_private.stamp_card_completion() from public;
create trigger stamp_card_completion before insert or update on public.oj_cards
  for each row execute function oj_private.stamp_card_completion();

-- 2. Timed work ---------------------------------------------------------------
create table public.oj_work_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  user_id uuid not null default auth.uid() references auth.users(id),
  -- 'general', or one of the businesses in src/lib/ventures.ts. A business added
  -- there has to be added here too; tests/work-leaderboard.test.ts fails until
  -- the two lists match.
  business text not null check (business in ('general','exterior','solutions','essentials')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- The last time the owner confirmed they were still working (the start counts).
  last_checkin_at timestamptz not null default now(),
  ended_reason text check (ended_reason in ('manual','idle','edited')),
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint oj_work_sessions_ended check ((ended_at is null) = (ended_reason is null)),
  constraint oj_work_sessions_order check (ended_at is null or ended_at >= started_at),
  constraint oj_work_sessions_checkin check (last_checkin_at >= started_at and (ended_at is null or last_checkin_at <= ended_at))
);
-- One running timer per person.
create unique index oj_work_sessions_one_open on public.oj_work_sessions(user_id) where ended_at is null;
create index oj_work_sessions_org on public.oj_work_sessions(organization_id, started_at desc);
create index oj_work_sessions_user on public.oj_work_sessions(user_id, started_at);

alter table public.oj_work_sessions enable row level security;
revoke all on public.oj_work_sessions from anon, authenticated;
grant select on public.oj_work_sessions to authenticated;
grant insert (organization_id, user_id, business, note) on public.oj_work_sessions to authenticated;
grant update (business, started_at, ended_at, last_checkin_at, ended_reason, note) on public.oj_work_sessions to authenticated;
-- Both partners read every session in the workspace; each starts and changes only their own. Nobody deletes.
create policy partner_read on public.oj_work_sessions for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy own_start on public.oj_work_sessions for insert to authenticated
  with check (oj_private.member_role(organization_id) in ('owner','member') and user_id = (select auth.uid()));
create policy own_change on public.oj_work_sessions for update to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member') and user_id = (select auth.uid()))
  with check (oj_private.member_role(organization_id) in ('owner','member') and user_id = (select auth.uid()));

-- The rules for a session, whoever writes it:
--   start:    the database sets the start and first check-in to now.
--   check in: a running timer moves its check-in to now, unless the check-in
--             was missed (more than 70 minutes ago): then it has already ended.
--   stop:     'manual' ends now. An unanswered check-in (over 70 minutes) always
--             ends at the last check-in as 'idle', whatever was asked. 'idle' may
--             be asked for once a check-in is due (60 minutes).
--   edit:     only a finished session, only with a note saying why; it becomes
--             'edited'. It cannot be reopened, end in the future, run past 24
--             hours, or overlap the same person's other sessions.
create function oj_private.guard_work_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now(); new.last_checkin_at := now(); new.created_at := now();
    new.ended_at := null; new.ended_reason := null;
    return new;
  end if;
  if new.id <> old.id or new.organization_id <> old.organization_id or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'Session identity is immutable';
  end if;

  if old.ended_at is null then
    if new.business <> old.business or new.started_at <> old.started_at or new.note <> old.note then
      raise exception 'A running timer can only be checked in or stopped';
    end if;
    if new.ended_at is null and new.ended_reason is null then
      if old.last_checkin_at < now() - interval '70 minutes' then
        raise exception 'This timer already ended at its last check-in';
      end if;
      new.last_checkin_at := now();
      return new;
    end if;
    if old.last_checkin_at < now() - interval '70 minutes' then
      new.ended_at := old.last_checkin_at; new.ended_reason := 'idle';
    elsif new.ended_reason = 'manual' then
      new.ended_at := now();
    elsif new.ended_reason = 'idle' and old.last_checkin_at <= now() - interval '60 minutes' then
      new.ended_at := old.last_checkin_at;
    else
      raise exception 'Stop a timer by hand, or at its last check-in once a check-in is due';
    end if;
    new.last_checkin_at := old.last_checkin_at;
    return new;
  end if;

  if new.ended_at is null then raise exception 'A finished session cannot be restarted'; end if;
  if length(btrim(new.note)) = 0 then raise exception 'Say why this session was edited'; end if;
  if new.ended_at > now() then raise exception 'A session cannot end in the future'; end if;
  if new.ended_at < new.started_at then raise exception 'A session must end after it starts'; end if;
  if new.ended_at - new.started_at > interval '24 hours' then raise exception 'A session can be at most 24 hours long'; end if;
  if exists (
    select 1 from public.oj_work_sessions s
    where s.user_id = new.user_id and s.id <> new.id
      and s.started_at < new.ended_at and coalesce(s.ended_at, 'infinity'::timestamptz) > new.started_at
  ) then raise exception 'This overlaps another of your sessions'; end if;
  new.ended_reason := 'edited';
  new.last_checkin_at := new.ended_at;
  return new;
end $$;
revoke all on function oj_private.guard_work_session() from public;
create trigger guard_work_session before insert or update on public.oj_work_sessions
  for each row execute function oj_private.guard_work_session();

-- 3. Ending timers nobody confirmed --------------------------------------------
-- Ends every timer in the workspace whose last check-in is more than 70 minutes
-- old, at that check-in, as 'idle'. Either partner may run it (the app does on
-- load), including for the other partner's timer, because all it can do is end
-- a session at the last moment its owner confirmed. Returns how many it ended.
create function public.oj_close_idle_work(org uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare closed integer;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(org), '') not in ('owner','member') then
    raise exception 'Workspace partner access required';
  end if;
  update public.oj_work_sessions set ended_reason = 'idle', ended_at = last_checkin_at
  where organization_id = org and ended_at is null and last_checkin_at < now() - interval '70 minutes';
  get diagnostics closed = row_count;
  return closed;
end $$;
revoke all on function public.oj_close_idle_work(uuid) from public, anon;
grant execute on function public.oj_close_idle_work(uuid) to authenticated;

-- 4. Scoring: the one source of truth ------------------------------------------
-- One row per partner per week, from the week of the first recorded work up to
-- the current week. A week runs Monday 00:00 to the next Monday 00:00 in
-- America/Chicago, so it is 167 hours long when clocks go forward and 169 when
-- they go back. A session that crosses midnight into Monday is split between
-- the two weeks.
--
--   hours  = whole minutes worked that week / 60, to 2 decimals. A running
--            timer counts up to now; a timer whose check-in was missed counts
--            only to its last check-in, even before it has been closed.
--   tasks  = tasks that partner moved to Done that week, counting only those
--            created at least 12 hours before they were finished, or created
--            by someone else.
--   points = hours + 3 per task.
--   won    = the week is over and this partner alone has the most points, above zero.
create function public.oj_work_scores(org uuid)
returns table(
  week_start date, starts_at timestamptz, ends_at timestamptz, user_id uuid,
  worked_seconds bigint, hours numeric, tasks integer, task_ids uuid[],
  points numeric, by_business jsonb, won boolean
)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null or coalesce(oj_private.member_role(org), '') not in ('owner','member') then
    raise exception 'Workspace partner access required';
  end if;
  return query
  with partners as (
    select m.user_id from public.oj_memberships m
    where m.organization_id = org and m.role in ('owner','member')
  ),
  sessions as (
    select s.user_id, s.business, s.started_at,
      case
        when s.ended_at is not null then s.ended_at
        when s.last_checkin_at < now() - interval '70 minutes' then s.last_checkin_at
        else greatest(now(), s.started_at)
      end as finish
    from public.oj_work_sessions s join partners p on p.user_id = s.user_id
    where s.organization_id = org
  ),
  slices as (
    select s.user_id, s.business, w.week,
      extract(epoch from least(s.finish, w.week_end) - greatest(s.started_at, w.week_begin)) as seconds
    from sessions s
    cross join lateral (
      select g::date as week,
        g at time zone 'America/Chicago' as week_begin,
        (g + interval '7 days') at time zone 'America/Chicago' as week_end
      from generate_series(
        date_trunc('week', s.started_at at time zone 'America/Chicago'),
        date_trunc('week', s.finish at time zone 'America/Chicago'),
        interval '7 days') g
    ) w
  ),
  per_business as (
    select sl.user_id, sl.week, sl.business, sum(sl.seconds) as seconds
    from slices sl where sl.seconds > 0
    group by sl.user_id, sl.week, sl.business
  ),
  time_total as (
    select b.user_id, b.week, floor(sum(b.seconds))::bigint as seconds,
      jsonb_object_agg(b.business, floor(b.seconds)::bigint) as businesses
    from per_business b
    group by b.user_id, b.week
  ),
  credited as (
    select c.id, c.completed_by as user_id, c.completed_at,
      date_trunc('week', c.completed_at at time zone 'America/Chicago')::date as week
    from public.oj_cards c join partners p on p.user_id = c.completed_by
    where c.organization_id = org and c.stage = 'Done' and c.completed_at is not null
      and (c.completed_at - c.created_at >= interval '12 hours' or c.created_by is distinct from c.completed_by)
  ),
  task_total as (
    select k.user_id, k.week, count(*)::integer as tasks, array_agg(k.id order by k.completed_at) as ids
    from credited k
    group by k.user_id, k.week
  ),
  bounds as (
    select date_trunc('week', now() at time zone 'America/Chicago')::date as this_week,
      least((select min(t.week) from time_total t), (select min(k.week) from task_total k)) as first_week,
      greatest((select max(t.week) from time_total t), (select max(k.week) from task_total k)) as last_week
  ),
  weeks as (
    select g::date as week
    from bounds b, generate_series(
      least(b.first_week, b.this_week)::timestamp,
      greatest(b.last_week, b.this_week)::timestamp,
      interval '7 days') g
  ),
  scored as (
    select w.week, p.user_id,
      coalesce(t.seconds, 0)::bigint as worked_seconds,
      round(floor(coalesce(t.seconds, 0) / 60.0) / 60.0, 2) as hours,
      coalesce(k.tasks, 0) as tasks,
      coalesce(k.ids, '{}'::uuid[]) as task_ids,
      coalesce(t.businesses, '{}'::jsonb) as by_business
    from weeks w cross join partners p
    left join time_total t on t.week = w.week and t.user_id = p.user_id
    left join task_total k on k.week = w.week and k.user_id = p.user_id
  ),
  pointed as (
    select s.*, s.hours + 3 * s.tasks as points,
      s.week::timestamp at time zone 'America/Chicago' as starts_at,
      (s.week + 7)::timestamp at time zone 'America/Chicago' as ends_at
    from scored s
  ),
  ranked as (
    select pt.*, max(pt.points) over (partition by pt.week) as top
    from pointed pt
  ),
  counted as (
    select r.*, count(*) filter (where r.points = r.top) over (partition by r.week) as at_top
    from ranked r
  )
  select c.week, c.starts_at, c.ends_at, c.user_id, c.worked_seconds, c.hours, c.tasks, c.task_ids,
    c.points, c.by_business, (c.ends_at <= now() and c.points > 0 and c.points = c.top and c.at_top = 1)
  from counted c
  order by c.week, c.user_id;
end $$;
revoke all on function public.oj_work_scores(uuid) from public, anon;
grant execute on function public.oj_work_scores(uuid) to authenticated;

-- Live updates: the app reloads when a session changes. Skipped where Supabase
-- Realtime is not present (the isolated test database).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.oj_work_sessions;
  end if;
end $$;

commit;
