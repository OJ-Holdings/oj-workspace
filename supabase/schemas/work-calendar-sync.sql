-- OJ Workspace: an outside calendar can keep a set of events on the shared calendar (Oscar's work shifts).
--
-- Desired state. Apply after workspace.sql and dashboard.sql. NOT applied to the live project: the paste-ready
-- copy is supabase/pending/RUN-ME-work-calendar-sync.sql, run after review. Additive: two columns and an index
-- on oj_events, one private table, one function; and the three oj_events write policies gain "source is null".
--
--   * An event with a source is owned by that outside calendar. Members read it like any event but cannot add,
--     change or remove one: the next sync would undo the edit, so the database refuses instead of pretending.
--   * oj_private.calendar_sources holds one row per (workspace, source): the SHA-256 of a 256-bit token and the
--     owner it acts for. It is written by hand by a database admin, never by the app. Replacing the hash revokes
--     the old token. It stops working the moment that owner is no longer an owner.
--   * oj_sync_calendar(token, items, from, to) makes the shared calendar match what the source sent for
--     [from, to): it adds new items, updates changed ones and removes the ones no longer sent. It touches only
--     rows of its own source, only inside that window, and nothing else in the database.
--     It stores a title, a start, an end and all-day. Never a location or notes.

alter table public.oj_events
  add column source text check (source is null or source ~ '^[a-z0-9-]{1,40}$'),
  add column external_id text check (external_id is null or length(external_id) between 1 and 120),
  add constraint oj_events_source_pair check ((source is null) = (external_id is null));
create unique index oj_events_synced on public.oj_events(organization_id, source, external_id) where source is not null;

drop policy member_add on public.oj_events;
drop policy member_change on public.oj_events;
drop policy member_remove on public.oj_events;
create policy member_add on public.oj_events for insert to authenticated
  with check (oj_private.member_role(organization_id) in ('owner','member') and created_by = (select auth.uid()) and source is null);
create policy member_change on public.oj_events for update to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member') and source is null)
  with check (oj_private.member_role(organization_id) in ('owner','member') and source is null);
create policy member_remove on public.oj_events for delete to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member') and source is null);

create table oj_private.calendar_sources (
  organization_id uuid not null references public.oj_organizations(id),
  source text not null check (source ~ '^[a-z0-9-]{1,40}$'),
  owner_id uuid not null references auth.users(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (organization_id, source)
);
alter table oj_private.calendar_sources enable row level security;
revoke all on oj_private.calendar_sources from public, anon, authenticated;

create function public.oj_sync_calendar(token text, items jsonb, window_from timestamptz, window_to timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s record;
  item jsonb;
  ext text; ttl text; st timestamptz; en timestamptz;
  keep text[] := '{}';
  added int := 0; removed int;
begin
  if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'Not authorised'; end if;
  select cs.organization_id, cs.source, cs.owner_id into s
  from oj_private.calendar_sources cs
  join public.oj_memberships m on m.organization_id = cs.organization_id and m.user_id = cs.owner_id and m.role = 'owner'
  where cs.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
  if not found then raise exception 'Not authorised'; end if;

  if window_from is null or window_to is null or window_to <= window_from or window_to - window_from > interval '200 days' then
    raise exception 'Choose a window of at most 200 days';
  end if;
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) > 200 then raise exception 'Send at most 200 items'; end if;

  for item in select * from jsonb_array_elements(items) loop
    ext := btrim(item ->> 'id'); ttl := btrim(item ->> 'title');
    st := (item ->> 'starts_at')::timestamptz; en := nullif(item ->> 'ends_at', '')::timestamptz;
    if ext is null or length(ext) not between 1 and 120 or ttl is null or length(ttl) not between 1 and 160 or st is null
       or st < window_from or st >= window_to or (en is not null and en < st) then
      raise exception 'An item is malformed or outside the window';
    end if;
    insert into public.oj_events(organization_id, venture, title, starts_at, ends_at, all_day, location, notes, created_by, source, external_id)
    values (s.organization_id, null, ttl, st, en, coalesce((item ->> 'all_day')::boolean, false), '', '', s.owner_id, s.source, ext)
    on conflict (organization_id, source, external_id) where source is not null
    do update set title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at, all_day = excluded.all_day, updated_at = now();
    keep := keep || ext; added := added + 1;
  end loop;

  delete from public.oj_events e
  where e.organization_id = s.organization_id and e.source = s.source
    and e.starts_at >= window_from and e.starts_at < window_to and not (e.external_id = any(keep));
  get diagnostics removed = row_count;
  return jsonb_build_object('synced', added, 'removed', removed);
end $$;
revoke all on function public.oj_sync_calendar(text, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.oj_sync_calendar(text, jsonb, timestamptz, timestamptz) to anon, authenticated;
