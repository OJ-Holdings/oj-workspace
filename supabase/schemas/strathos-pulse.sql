-- Desired additive schema, after workspace.sql and dashboard.sql (presence.sql is optional: see below).
-- A read-only summary of the workspace for the owner's private STRATHOS dashboard. It uses the SAME private link
-- token as the calendar subscription (only the SHA-256 is stored), so it stops working the moment the member is
-- removed or the link is regenerated, and it needs no service key.
--
-- Returned: money logged (category and amount only, no notes), open leads by stage, open tasks and what is due soon,
-- and each member's connection state with the status line they chose to write. It never returns messages, documents,
-- lead names or contact details, task descriptions, or anything a member did not choose to share with the team.
-- Presence is read only if presence.sql has been applied; otherwise members report offline.
create function public.oj_pulse(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  f record;
  members jsonb := '[]'::jsonb;
  finance jsonb;
  leads jsonb;
  due jsonb;
  open_tasks integer;
  org_name text;
begin
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select cf.organization_id, cf.user_id into f
  from oj_private.calendar_feeds cf
  join public.oj_memberships m on m.organization_id = cf.organization_id and m.user_id = cf.user_id
  where cf.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
  if not found then return null; end if;

  select name into org_name from public.oj_organizations where id = f.organization_id;

  if to_regclass('public.oj_presence_sessions') is not null and to_regclass('public.oj_current_work') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', m.display_name,
        'isYou', m.user_id = $2,
        'state', case when s.online then 'online' when s.away then 'away' else 'offline' end,
        'lastSeen', s.last_seen,
        'work', case when w.note is not null and btrim(w.note) <> '' then jsonb_build_object('note', w.note, 'updatedAt', w.updated_at) else null end
      ) order by m.display_name), '[]'::jsonb)
      from public.oj_memberships m
      left join lateral (
        select bool_or(p.state = 'online' and p.seen_at > now() - interval '90 seconds') as online,
               bool_or(p.state = 'away' and p.seen_at > now() - interval '90 seconds') as away,
               max(p.seen_at) as last_seen
        from public.oj_presence_sessions p
        where p.organization_id = m.organization_id and p.user_id = m.user_id
      ) s on true
      left join public.oj_current_work w on w.organization_id = m.organization_id and w.user_id = m.user_id
      where m.organization_id = $1
    $q$ into members using f.organization_id, f.user_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object('name', m.display_name, 'isYou', m.user_id = f.user_id, 'state', 'offline', 'lastSeen', null, 'work', null) order by m.display_name), '[]'::jsonb)
    into members from public.oj_memberships m where m.organization_id = f.organization_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('date', e.occurred_on, 'venture', e.venture, 'kind', e.kind, 'amount', e.amount, 'category', e.category) order by e.occurred_on desc), '[]'::jsonb)
  into finance
  from (
    select occurred_on, venture, kind, amount, category from public.oj_finance_entries
    where organization_id = f.organization_id and occurred_on > current_date - 120
    order by occurred_on desc, created_at desc limit 500
  ) e;

  select coalesce(jsonb_agg(jsonb_build_object('venture', l.venture, 'stage', l.stage, 'count', l.n)), '[]'::jsonb)
  into leads
  from (
    select venture, stage, count(*)::int as n from public.oj_leads
    where organization_id = f.organization_id and stage not in ('Won', 'Lost')
    group by venture, stage
  ) l;

  select count(*)::int into open_tasks from public.oj_cards where organization_id = f.organization_id and stage <> 'Done';

  select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'dueDate', c.due_date, 'stage', c.stage, 'business', c.business) order by c.due_date, c.title), '[]'::jsonb)
  into due
  from (
    select title, due_date, stage, business from public.oj_cards
    where organization_id = f.organization_id and stage <> 'Done' and due_date is not null
      and due_date between current_date - 3 and current_date + 14
    order by due_date, title limit 12
  ) c;

  return jsonb_build_object(
    'version', 1,
    'generatedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'organization', org_name,
    'members', members,
    'finance', finance,
    'leads', leads,
    'tasks', jsonb_build_object('open', open_tasks, 'dueSoon', due)
  );
end $$;
revoke all on function public.oj_pulse(text) from public, anon;
grant execute on function public.oj_pulse(text) to anon, authenticated;
