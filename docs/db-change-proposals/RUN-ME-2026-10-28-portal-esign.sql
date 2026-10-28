-- OJ OS: customer proposal links and e-sign (master plan 6.10, 6.12 and 6.16).
-- A member shares a private link to a SENT proposal; the customer opens it with no account, reads the proposal, chooses any optional add-ons,
-- and accepts it with a typed signature or declines it. Every decision leaves an audit record: typed name, time,
-- the add-ons chosen, the agreed total, and a SHA-256 fingerprint of the exact document that was shown.
-- REQUIRES RUN-ME-2026-10-28-proposals.sql to have been run first. Additive only. Run once in the Supabase SQL editor.
--
-- How the link stays private:
--   * the link carries a 256-bit random token; only its SHA-256 hash is stored here, so a database leak does not expose live links;
--   * the public functions below return only what the customer is meant to see (never internal notes, ids of other records, or anyone else's data);
--   * a link works for one proposal only, stops at its expiry or when a member revokes it, and a decided proposal cannot be decided again;
--   * nothing here gives the public any read or write access to any table: only these functions.
begin;

create table public.oj_portal_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  proposal_id uuid not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (token_hash),
  unique (organization_id, id),
  foreign key (organization_id, proposal_id) references public.oj_proposals(organization_id, id)
);
create index oj_portal_links_proposal on public.oj_portal_links(organization_id, proposal_id);
create index oj_portal_links_created_by on public.oj_portal_links(created_by);

create table public.oj_proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  proposal_id uuid not null,
  link_id uuid not null,
  decision text not null check (decision in ('accepted','declined')),
  signer_name text not null check (length(btrim(signer_name)) between 2 and 200),
  note text not null default '' check (length(note) <= 500),
  selected_optional_ids uuid[] not null default '{}',
  agreed_total_cents bigint not null check (agreed_total_cents >= 0),
  document_hash text not null check (document_hash ~ '^[a-f0-9]{64}$'),
  -- Network fields are reserved for a future trusted receipt. Anonymous callers can invoke this RPC directly, so supplied headers cannot prove identity.
  ip_address text check (ip_address is null or length(ip_address) <= 64),
  forwarded_for text check (forwarded_for is null or length(forwarded_for) <= 300),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  foreign key (organization_id, proposal_id) references public.oj_proposals(organization_id, id),
  foreign key (organization_id, link_id) references public.oj_portal_links(organization_id, id)
);
create index oj_proposal_acceptances_proposal on public.oj_proposal_acceptances(organization_id, proposal_id);
create index oj_proposal_acceptances_link on public.oj_proposal_acceptances(organization_id, link_id);

alter table public.oj_portal_links enable row level security;
alter table public.oj_proposal_acceptances enable row level security;
revoke all on public.oj_portal_links, public.oj_proposal_acceptances from public, anon, authenticated;
grant select on public.oj_portal_links, public.oj_proposal_acceptances to authenticated;
-- The token hash is not useful to read, but there is no reason to expose it either: members see their links and the audit trail, through these policies only.
create policy portal_links_read on public.oj_portal_links for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));
create policy acceptances_read on public.oj_proposal_acceptances for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));

-- Acceptances are a permanent record: no edits, no deletes, by anyone.
create function oj_private.acceptances_append_only() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Acceptances are a permanent record and cannot be changed.'; end $$;
revoke all on function oj_private.acceptances_append_only() from public;
create trigger acceptances_no_change before update or delete on public.oj_proposal_acceptances for each row execute function oj_private.acceptances_append_only();

-- A member shares a sent proposal. The caller generates the random token and sends only its hash; the token itself is never stored.
create function public.oj_create_portal_link(p_org uuid, p_proposal uuid, p_digest text, p_days integer) returns uuid language plpgsql security definer set search_path = '' as $$
declare prop public.oj_proposals; link uuid; days integer := least(greatest(coalesce(p_days, 30), 1), 90);
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid link'; end if;
  select * into prop from public.oj_proposals where organization_id = p_org and id = p_proposal;
  if not found then raise exception 'Proposal not found'; end if;
  if prop.status <> 'sent' then raise exception 'Only a sent proposal can be shared. Mark it sent first.'; end if;
  -- One live link per proposal: sharing again retires every earlier link, so an old copy cannot linger.
  update public.oj_portal_links set revoked_at = now() where organization_id = p_org and proposal_id = p_proposal and revoked_at is null;
  insert into public.oj_portal_links(organization_id, proposal_id, token_hash, expires_at)
    values (p_org, p_proposal, p_digest, least(now() + make_interval(days => days), (prop.valid_until + 1)::timestamptz)) returning id into link;
  return link;
end $$;

create function public.oj_revoke_portal_link(p_org uuid, p_link uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  update public.oj_portal_links set revoked_at = now() where organization_id = p_org and id = p_link and revoked_at is null;
end $$;

-- Stop sharing: every live link for a proposal stops working at once.
create function public.oj_revoke_proposal_links(p_org uuid, p_proposal uuid) returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  update public.oj_portal_links set revoked_at = now() where organization_id = p_org and proposal_id = p_proposal and revoked_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Marking a proposal accepted, declined or expired by hand also closes its links (replaces the function from the proposals script, otherwise unchanged).
create or replace function public.oj_set_proposal_status(p_org uuid, p_proposal uuid, p_status text, p_date date, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare cur public.oj_proposals;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  select * into cur from public.oj_proposals where organization_id = p_org and id = p_proposal for update;
  if not found then raise exception 'Proposal not found'; end if;
  if p_date is null then raise exception 'Choose a date'; end if;
  if p_status = 'sent' and cur.status = 'draft' then
    perform set_config('oj.allow_proposal_change', '1', true);
    update public.oj_proposals set status = 'sent', sent_on = p_date where id = p_proposal;
  elsif p_status in ('accepted', 'declined', 'expired') and cur.status = 'sent' then
    perform set_config('oj.allow_proposal_change', '1', true);
    update public.oj_proposals set status = p_status, decided_on = p_date, decision_note = left(coalesce(p_note, ''), 500) where id = p_proposal;
    update public.oj_portal_links set revoked_at = now() where organization_id = p_org and proposal_id = p_proposal and revoked_at is null;
  else
    raise exception 'A % proposal cannot be marked %', cur.status, p_status;
  end if;
end $$;

-- The one place a token is turned into a link record. Anything wrong with the token gives the same answer, so a guesser learns nothing.
create function oj_private.live_portal_link(p_token text) returns public.oj_portal_links language plpgsql stable security definer set search_path = '' as $$
declare l public.oj_portal_links;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 200 then return null; end if;
  select * into l from public.oj_portal_links where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if not found or l.revoked_at is not null or l.expires_at < now() then return null; end if;
  return l;
end $$;
revoke all on function oj_private.live_portal_link(text) from public;

-- What the customer sees: the proposal as it will be agreed, and nothing else.
create function public.oj_portal_proposal(p_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.oj_portal_links; p public.oj_proposals; items jsonb; signed jsonb;
begin
  l := oj_private.live_portal_link(p_token);
  if l.id is null then return null; end if;
  select * into p from public.oj_proposals where organization_id = l.organization_id and id = l.proposal_id;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'description', x.description, 'detail', x.detail, 'quantity', x.quantity, 'unit_price_cents', x.unit_price_cents, 'amount_cents', x.amount_cents, 'optional', x.optional) order by x.position), '[]'::jsonb)
    into items from public.oj_proposal_lines x where x.organization_id = l.organization_id and x.proposal_id = l.proposal_id;
  select jsonb_build_object('decision', a.decision, 'signer_name', a.signer_name, 'at', a.created_at, 'agreed_total_cents', a.agreed_total_cents, 'selected_optional_ids', a.selected_optional_ids)
    into signed from public.oj_proposal_acceptances a where a.organization_id = l.organization_id and a.proposal_id = l.proposal_id order by a.created_at desc limit 1;
  update public.oj_portal_links set last_seen_at = now() where id = l.id;
  return jsonb_build_object('number', p.number, 'division', p.division, 'customer_name', p.customer_name, 'site_address', p.site_address, 'status', p.status, 'valid_until', p.valid_until,
    'payment_terms', p.payment_terms, 'terms', p.terms, 'exclusions', p.exclusions, 'notes', p.notes, 'subtotal_cents', p.subtotal_cents, 'discount_cents', p.discount_cents,
    'total_cents', p.total_cents, 'lines', items, 'decision', signed, 'expired', p.valid_until < current_date);
end $$;

-- The customer accepts (with a typed signature and any optional add-ons) or declines. Only a sent, unexpired, undecided proposal can be decided.
create function public.oj_portal_decide(p_token text, p_decision text, p_name text, p_note text, p_optional uuid[], p_ip text, p_forwarded text, p_agent text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.oj_portal_links; p public.oj_proposals; chosen uuid[] := '{}'; extra bigint := 0; total bigint; doc text; hash text; who text := btrim(coalesce(p_name, ''));
begin
  l := oj_private.live_portal_link(p_token);
  if l.id is null then raise exception 'This link is no longer valid'; end if;
  if p_decision not in ('accepted', 'declined') then raise exception 'Choose accept or decline'; end if;
  if length(who) < 2 then raise exception 'Type your full name to sign'; end if;
  select * into p from public.oj_proposals where organization_id = l.organization_id and id = l.proposal_id for update;
  if p.status <> 'sent' then raise exception 'This proposal has already been decided'; end if;
  if p.valid_until < current_date then raise exception 'This proposal has expired. Please ask for a new one'; end if;
  if p_decision = 'accepted' and p_optional is not null then
    select coalesce(array_agg(x.id), '{}'), coalesce(sum(x.amount_cents), 0) into chosen, extra
      from public.oj_proposal_lines x where x.organization_id = l.organization_id and x.proposal_id = l.proposal_id and x.optional and x.id = any(p_optional);
  end if;
  total := p.total_cents + extra;
  select concat_ws('|', p.number, p.customer_name, p.site_address, p.valid_until::text, p.subtotal_cents::text, p.discount_cents::text, p.total_cents::text, p.payment_terms, p.terms, p.exclusions, p.notes,
      coalesce((select string_agg(concat_ws('~', x.position::text, x.description, x.detail, x.quantity::text, x.unit_price_cents::text, x.amount_cents::text, x.optional::text), ';' order by x.position)
                from public.oj_proposal_lines x where x.organization_id = l.organization_id and x.proposal_id = l.proposal_id), ''))
    into doc;
  hash := encode(sha256(convert_to(doc, 'UTF8')), 'hex');
  insert into public.oj_proposal_acceptances(organization_id, proposal_id, link_id, decision, signer_name, note, selected_optional_ids, agreed_total_cents, document_hash, ip_address, forwarded_for, user_agent)
    values (l.organization_id, l.proposal_id, l.id, p_decision, left(who, 200), left(coalesce(p_note, ''), 500), chosen, case when p_decision = 'accepted' then total else 0 end, hash, null, null, null);
  -- Once decided, the customer's link only needs to last long enough to print their copy.
  update public.oj_portal_links set expires_at = least(expires_at, now() + interval '7 days') where organization_id = l.organization_id and proposal_id = l.proposal_id;
  perform set_config('oj.allow_proposal_change', '1', true);
  update public.oj_proposals set status = p_decision, decided_on = current_date,
    decision_note = left(case when p_decision = 'accepted' then 'Accepted online by ' else 'Declined online by ' end || left(who, 100) || case when coalesce(p_note, '') = '' then '' else ': ' || p_note end, 500)
    where id = l.proposal_id;
  return jsonb_build_object('decision', p_decision, 'agreed_total_cents', case when p_decision = 'accepted' then total else 0 end, 'document_hash', hash);
end $$;

revoke all on function public.oj_create_portal_link(uuid, uuid, text, integer), public.oj_revoke_portal_link(uuid, uuid), public.oj_revoke_proposal_links(uuid, uuid), public.oj_portal_proposal(text),
  public.oj_portal_decide(text, text, text, text, uuid[], text, text, text) from public, anon, authenticated;
grant execute on function public.oj_create_portal_link(uuid, uuid, text, integer), public.oj_revoke_portal_link(uuid, uuid), public.oj_revoke_proposal_links(uuid, uuid) to authenticated;
-- The two public functions are the whole public surface, and they are guarded by the token.
grant execute on function public.oj_portal_proposal(text), public.oj_portal_decide(text, text, text, text, uuid[], text, text, text) to anon, authenticated;
-- Re-grant the replaced status function (create or replace keeps its grants, this just states them).
grant execute on function public.oj_set_proposal_status(uuid, uuid, text, date, text) to authenticated;

commit;
