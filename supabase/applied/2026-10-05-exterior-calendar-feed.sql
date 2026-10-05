-- Applied to the live project (vgckpcktsfuithqggknd) on 2026-10-05 with Oscar's OK, as migration exterior_calendar_feed.
-- Source: supabase/schemas/exterior-calendar-feed.sql. To undo, re-run the oj_calendar_feed definition in supabase/schemas/dashboard.sql.
-- OJ Workspace: Exterior Care jobs in the iPhone calendar link.
--
-- Apply after dashboard.sql (which first defines oj_calendar_feed) and exterior-read.sql
-- (which records the workspace that owns the Exterior Care records).
--
-- Replaces oj_calendar_feed with the same signature and the same two parts (workspace
-- events, task due dates), plus a third: Exterior Care bookings, except denied ones,
-- from 60 days back. Each job becomes an event at its booked time in Kenosha's time
-- zone, titled with the customer and service, the address as its location and the
-- quote, phone and approval state in its notes. A booking whose time cannot be read
-- shows as an all-day event on its date.
--
-- Jobs carry customers' names, phone numbers and addresses, so, as in the workspace
-- itself, only owners' and members' links include them; a viewer's link does not.
-- Read only: nothing here changes a booking.
create or replace function public.oj_calendar_feed(token text)
returns table(id uuid, title text, starts_at timestamptz, ends_at timestamptz, all_day boolean, location text, notes text, venture text)
language sql stable security definer set search_path = '' as $$
  with feed as (
    select f.organization_id, m.role from oj_private.calendar_feeds f
    join public.oj_memberships m on m.organization_id = f.organization_id and m.user_id = f.user_id
    where token ~ '^[a-f0-9]{64}$' and f.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
  )
  select e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.location, e.notes, e.venture
  from public.oj_events e join feed on feed.organization_id = e.organization_id
  where e.starts_at > now() - interval '60 days' and e.starts_at < now() + interval '400 days'
  union all
  select c.id, c.title, c.due_date::timestamptz, null::timestamptz, true, ''::text, ('Task / ' || c.stage)::text, c.business
  from public.oj_cards c join feed on feed.organization_id = c.organization_id
  where c.due_date is not null and c.stage <> 'Done' and c.due_date > current_date - 60
  union all
  select b.id,
    (coalesce(nullif(l.name, ''), 'Customer') || coalesce(' / ' || nullif(l.service_requested, ''), ''))::text,
    case when t.s is null then b.date::timestamptz else (b.date + make_interval(mins => t.s)) at time zone 'America/Chicago' end,
    case when t.e is null then null else (b.date + make_interval(mins => t.e)) at time zone 'America/Chicago' end,
    t.s is null,
    coalesce(l.address, '')::text,
    concat_ws(E'\n', 'Exterior Care job',
      case when l.quote_amount is not null then 'Quote $' || to_char(round(l.quote_amount), 'FM999,999,990') end,
      nullif(l.phone, ''),
      case when b.status = 'pending_approval' then 'Waiting for approval' end)::text,
    'exterior'::text
  from public.bookings b
  join feed on feed.role in ('owner', 'member')
  join oj_private.legacy_owner o on o.organization_id = feed.organization_id
  left join public.leads l on l.id = b.lead_id
  -- The time block in the workspace's 12-hour style ('9-12', '4:30-9'): hours 1 to 7 are PM,
  -- 8 to 11 AM, 12 noon; the end is the first matching time after the start (src/lib/exterior-ops.ts parseBlock).
  left join lateral (
    select q.s, (select min(x) from unnest(array[q.eh * 60 + q.em, (q.eh + 12) * 60 + q.em]) x where x > q.s) as e
    from (
      select (case when p[1]::int < 8 then p[1]::int + 12 else p[1]::int end) * 60 + coalesce(p[2]::int, 0) as s,
        p[3]::int as eh, coalesce(p[4]::int, 0) as em
      from regexp_match(b.time_block, '^(1[0-2]|[1-9])(?::([0-5][0-9]))?-(1[0-2]|[1-9])(?::([0-5][0-9]))?$') as r(p)
    ) q
  ) t on true
  where b.status is distinct from 'denied' and b.date > current_date - 60
$$;
revoke all on function public.oj_calendar_feed(text) from public, anon;
grant execute on function public.oj_calendar_feed(text) to anon, authenticated;
