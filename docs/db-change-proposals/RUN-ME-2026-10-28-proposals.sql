-- OJ OS: proposals (master plan 1d, 6.16 and Phase 4): priced quotes for commercial and large jobs, numbered, with line items, optional add-ons
-- (for example a monthly maintenance visit), a package discount, a validity date, terms, and a status that moves draft -> sent -> accepted, declined or expired.
-- Additive only: three new tables and four functions; nothing existing is changed. Run once in the Supabase SQL editor.
-- Until it is run, the Proposals page says it is not switched on yet and nothing breaks.
--
-- Proposals are created and moved between statuses only through the functions below, so numbers never repeat and totals always match their lines.
-- A proposal is not an invoice and posts nothing to the books. Sales tax is not calculated (the Wisconsin treatment is still unconfirmed).
begin;

create table public.oj_proposal_counters (
  organization_id uuid not null references public.oj_organizations(id),
  year integer not null,
  last_number integer not null default 0,
  primary key (organization_id, year)
);

create table public.oj_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  number text not null,
  division text not null check (division in ('exterior','solutions','essentials','content','shared')),
  -- The customer's lead (public.leads.id), when there is one. No foreign key: that table belongs to the original Exterior Care app.
  lead_id uuid,
  customer_name text not null check (length(btrim(customer_name)) between 1 and 200),
  customer_email text check (customer_email is null or length(customer_email) <= 200),
  site_address text not null default '' check (length(site_address) <= 500),
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired')),
  valid_until date not null,
  payment_terms text not null default '' check (length(payment_terms) <= 200),
  terms text not null default '' check (length(terms) <= 4000),
  exclusions text not null default '' check (length(exclusions) <= 4000),
  notes text not null default '' check (length(notes) <= 2000),
  subtotal_cents bigint not null check (subtotal_cents > 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  total_cents bigint not null check (total_cents > 0),
  sent_on date,
  decided_on date,
  decision_note text not null default '' check (length(decision_note) <= 500),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  check (discount_cents < subtotal_cents),
  check (total_cents = subtotal_cents - discount_cents)
);
create index oj_proposals_status on public.oj_proposals(organization_id, status, valid_until);
create index oj_proposals_lead on public.oj_proposals(organization_id, lead_id) where lead_id is not null;
create index oj_proposals_created_by on public.oj_proposals(created_by);

create table public.oj_proposal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  proposal_id uuid not null,
  position integer not null check (position > 0),
  description text not null check (length(btrim(description)) between 1 and 300),
  detail text not null default '' check (length(detail) <= 1000),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents > 0),
  amount_cents bigint not null check (amount_cents > 0),
  -- An optional line is an add-on the customer may choose (for example monthly maintenance); it is not part of the total.
  optional boolean not null default false,
  foreign key (organization_id, proposal_id) references public.oj_proposals(organization_id, id)
);
create index oj_proposal_lines_by_proposal on public.oj_proposal_lines(organization_id, proposal_id, position);

alter table public.oj_proposal_counters enable row level security;
alter table public.oj_proposals enable row level security;
alter table public.oj_proposal_lines enable row level security;
revoke all on public.oj_proposal_counters, public.oj_proposals, public.oj_proposal_lines from public, anon, authenticated;
grant select on public.oj_proposals, public.oj_proposal_lines to authenticated;
-- Pricing and customer names are business financials: owners and members read, view-only members do not.
create policy proposals_read on public.oj_proposals for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));
create policy proposal_lines_read on public.oj_proposal_lines for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));
-- The counters table has RLS on and no policy: only the functions below touch it.

-- p_customer: {"name": text, "email": text|null, "address": text|null, "lead_id": uuid|null}
-- p_lines: [{"description": text, "detail": text|null, "quantity": number, "unit_price_cents": int, "optional": bool}, ...]
create function public.oj_create_proposal(p_org uuid, p_customer jsonb, p_division text, p_valid date, p_payment_terms text, p_terms text, p_exclusions text, p_notes text, p_discount_cents bigint, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare prop uuid; item jsonb; pos integer := 0; qty numeric; price bigint; amt bigint; subtotal bigint := 0; n integer; yr integer; number_text text; disc bigint := coalesce(p_discount_cents, 0);
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 60 then raise exception 'A proposal needs between 1 and 60 lines'; end if;
  if p_valid is null or p_valid < current_date then raise exception 'The valid-until date cannot be in the past'; end if;
  if disc < 0 then raise exception 'The discount cannot be negative'; end if;
  for item in select * from jsonb_array_elements(p_lines) loop
    qty := (item->>'quantity')::numeric; price := (item->>'unit_price_cents')::bigint;
    if qty is null or qty <= 0 or price is null or price <= 0 then raise exception 'Each line needs a positive quantity and price'; end if;
    amt := round(qty * price)::bigint;
    if amt <= 0 then raise exception 'Each line must total more than zero'; end if;
    if not coalesce((item->>'optional')::boolean, false) then subtotal := subtotal + amt; end if;
  end loop;
  if subtotal <= 0 then raise exception 'A proposal needs at least one line that is not optional'; end if;
  if disc >= subtotal then raise exception 'The discount must be less than the subtotal'; end if;
  yr := extract(year from current_date)::integer;
  insert into public.oj_proposal_counters(organization_id, year, last_number) values (p_org, yr, 1)
    on conflict (organization_id, year) do update set last_number = public.oj_proposal_counters.last_number + 1 returning last_number into n;
  number_text := 'OJ-' || yr::text || '-' || lpad(n::text, 4, '0');
  insert into public.oj_proposals(organization_id, number, division, lead_id, customer_name, customer_email, site_address, valid_until, payment_terms, terms, exclusions, notes, subtotal_cents, discount_cents, total_cents)
    values (p_org, number_text, p_division, nullif(p_customer->>'lead_id', '')::uuid, p_customer->>'name', nullif(p_customer->>'email', ''), coalesce(p_customer->>'address', ''), p_valid,
            coalesce(p_payment_terms, ''), coalesce(p_terms, ''), coalesce(p_exclusions, ''), coalesce(p_notes, ''), subtotal, disc, subtotal - disc)
    returning id into prop;
  for item in select * from jsonb_array_elements(p_lines) loop
    pos := pos + 1;
    qty := (item->>'quantity')::numeric; price := (item->>'unit_price_cents')::bigint;
    insert into public.oj_proposal_lines(organization_id, proposal_id, position, description, detail, quantity, unit_price_cents, amount_cents, optional)
      values (p_org, prop, pos, item->>'description', coalesce(item->>'detail', ''), qty, price, round(qty * price)::bigint, coalesce((item->>'optional')::boolean, false));
  end loop;
  return prop;
end $$;

-- draft -> sent -> accepted | declined | expired. A decided proposal does not move again.
create function public.oj_set_proposal_status(p_org uuid, p_proposal uuid, p_status text, p_date date, p_note text)
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
  else
    raise exception 'A % proposal cannot be marked %', cur.status, p_status;
  end if;
end $$;

-- Only a draft can be thrown away; anything sent stays on record.
create function public.oj_delete_draft_proposal(p_org uuid, p_proposal uuid) returns void language plpgsql security definer set search_path = '' as $$
declare cur public.oj_proposals;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  select * into cur from public.oj_proposals where organization_id = p_org and id = p_proposal for update;
  if not found then raise exception 'Proposal not found'; end if;
  if cur.status <> 'draft' then raise exception 'Only a draft proposal can be deleted'; end if;
  perform set_config('oj.allow_proposal_change', '1', true);
  delete from public.oj_proposal_lines where organization_id = p_org and proposal_id = p_proposal;
  delete from public.oj_proposals where id = p_proposal;
end $$;

-- Proposals and their lines change only through the functions above (they set oj.allow_proposal_change for the transaction).
create function oj_private.guard_proposal_change() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('oj.allow_proposal_change', true), '') <> '1' then raise exception 'Proposals change only through the proposal functions.'; end if;
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.number <> old.number or new.total_cents <> old.total_cents or new.subtotal_cents <> old.subtotal_cents
     or new.discount_cents <> old.discount_cents or new.customer_name <> old.customer_name) then raise exception 'A proposal''s number, customer and amounts cannot be edited.'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function oj_private.guard_proposal_change() from public;
create trigger proposals_guard_update before update or delete on public.oj_proposals for each row execute function oj_private.guard_proposal_change();
create function oj_private.guard_proposal_line_change() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('oj.allow_proposal_change', true), '') <> '1' then raise exception 'Proposals change only through the proposal functions.'; end if;
  if tg_op = 'UPDATE' then raise exception 'Proposal lines cannot be edited.'; end if;
  return old;
end $$;
revoke all on function oj_private.guard_proposal_line_change() from public;
create trigger proposal_lines_guard before update or delete on public.oj_proposal_lines for each row execute function oj_private.guard_proposal_line_change();

revoke all on function public.oj_create_proposal(uuid, jsonb, text, date, text, text, text, text, bigint, jsonb), public.oj_set_proposal_status(uuid, uuid, text, date, text),
  public.oj_delete_draft_proposal(uuid, uuid) from public, anon;
grant execute on function public.oj_create_proposal(uuid, jsonb, text, date, text, text, text, text, bigint, jsonb), public.oj_set_proposal_status(uuid, uuid, text, date, text),
  public.oj_delete_draft_proposal(uuid, uuid) to authenticated;

commit;
