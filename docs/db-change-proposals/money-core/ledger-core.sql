-- OJ OS money core, part 1: the double-entry ledger. Staged here (not in supabase/schemas) so the guarded deployer is not blocked; promote to supabase/schemas when it is applied. Additive, NOT applied to the live project.
-- Apply after workspace.sql. A founder reviews and applies it only after a real backup (see docs/DEPLOYMENT.md).
--
-- Rules the database itself enforces:
--   * Money is whole cents (bigint). A line is a debit or a credit, never both, never zero or negative.
--   * Every journal entry has at least two lines and total debits equal total credits (checked when the transaction commits).
--   * Posted entries and lines are append-only: no update, no delete, for anyone. A mistake is fixed by a reversing entry.
--   * Nothing is written directly. Members call oj_post_journal / oj_reverse_journal; owners also seed accounts and lock periods.
--   * Retrying the same posting with the same idempotency key returns the original entry instead of posting twice.
--   * A locked period (through a date) refuses new postings dated on or before it.
--   * One company: books are for OJ Holdings LLC as a whole. The division (exterior, solutions, essentials, content, shared) is a tag on each line.

create table public.oj_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  code text not null check (code ~ '^[0-9]{3,6}$'),
  name text not null check (length(btrim(name)) between 1 and 80),
  type text not null check (type in ('asset','liability','equity','income','cogs','expense')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.oj_ledger_locks (
  organization_id uuid primary key references public.oj_organizations(id),
  locked_through date not null,
  locked_by uuid not null default auth.uid() references auth.users(id),
  locked_at timestamptz not null default now()
);

create table public.oj_journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  entry_date date not null,
  memo text not null default '' check (length(memo) <= 300),
  source_type text not null default 'manual' check (source_type in ('manual','job','invoice','payment','expense','bank','payout','opening','reversal')),
  source_id uuid,
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 1 and 200),
  reversal_of uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, reversal_of) references public.oj_journal_entries(organization_id, id)
);
create unique index oj_journal_idempotency on public.oj_journal_entries(organization_id, idempotency_key) where idempotency_key is not null;
create unique index oj_journal_one_reversal on public.oj_journal_entries(organization_id, reversal_of) where reversal_of is not null;
create index oj_journal_by_date on public.oj_journal_entries(organization_id, entry_date desc);
create index oj_journal_by_source on public.oj_journal_entries(organization_id, source_type, source_id);
create index oj_journal_created_by on public.oj_journal_entries(created_by);

create table public.oj_journal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  entry_id uuid not null,
  account_id uuid not null,
  division text not null check (division in ('exterior','solutions','essentials','content','shared')),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  memo text not null default '' check (length(memo) <= 200),
  check ((debit_cents > 0) <> (credit_cents > 0)),
  foreign key (organization_id, entry_id) references public.oj_journal_entries(organization_id, id),
  foreign key (organization_id, account_id) references public.oj_accounts(organization_id, id)
);
create index oj_lines_by_entry on public.oj_journal_lines(organization_id, entry_id);
create index oj_lines_by_account on public.oj_journal_lines(organization_id, account_id);
create index oj_lines_by_division on public.oj_journal_lines(organization_id, division);

alter table public.oj_accounts enable row level security;
alter table public.oj_ledger_locks enable row level security;
alter table public.oj_journal_entries enable row level security;
alter table public.oj_journal_lines enable row level security;
revoke all on public.oj_accounts, public.oj_ledger_locks, public.oj_journal_entries, public.oj_journal_lines from public, anon, authenticated;
grant select on public.oj_accounts, public.oj_ledger_locks, public.oj_journal_entries, public.oj_journal_lines to authenticated;

create policy accounts_read on public.oj_accounts for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy locks_read on public.oj_ledger_locks for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy journal_read on public.oj_journal_entries for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy lines_read on public.oj_journal_lines for select to authenticated using (oj_private.member_role(organization_id) is not null);

-- Append-only, for everyone including the table owner.
create function oj_private.ledger_append_only() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Journal entries and lines are append-only. Post a reversing entry instead.';
end $$;
revoke all on function oj_private.ledger_append_only() from public;
create trigger journal_entries_append_only before update or delete on public.oj_journal_entries for each row execute function oj_private.ledger_append_only();
create trigger journal_lines_append_only before update or delete on public.oj_journal_lines for each row execute function oj_private.ledger_append_only();

-- Defence in depth: whatever path inserts lines, the entry must balance when the transaction commits.
create function oj_private.ledger_entry_balanced() returns trigger language plpgsql set search_path = '' as $$
declare d bigint; c bigint; n integer;
begin
  select coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0), count(*) into d, c, n
  from public.oj_journal_lines where organization_id = new.organization_id and entry_id = new.entry_id;
  if n < 2 then raise exception 'A journal entry needs at least two lines.'; end if;
  if d <> c then raise exception 'Journal entry is not balanced: debits % cents, credits % cents.', d, c; end if;
  return null;
end $$;
revoke all on function oj_private.ledger_entry_balanced() from public;
create constraint trigger journal_lines_balanced after insert on public.oj_journal_lines deferrable initially deferred for each row execute function oj_private.ledger_entry_balanced();

-- Post one balanced entry (internal worker; the public wrapper below blocks the entry types and key prefixes that belong to the invoice functions). p_lines: [{"account_id": uuid, "division": text, "debit_cents": int, "credit_cents": int, "memo": text}, ...]
create function oj_private.post_journal(p_org uuid, p_date date, p_memo text, p_source_type text, p_source_id uuid, p_key text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry uuid; item jsonb; deb bigint := 0; cred bigint := 0; locked date; acct record; d bigint; c bigint; hit record;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_date is null then raise exception 'Choose an entry date'; end if;
  if p_key is not null then
    select id, source_type, source_id into hit from public.oj_journal_entries where organization_id = p_org and idempotency_key = p_key;
    if found then
      if hit.source_type is distinct from coalesce(p_source_type, 'manual') or hit.source_id is distinct from p_source_id then raise exception 'That idempotency key was already used for a different entry'; end if;
      return hit.id;
    end if;
  end if;
  select locked_through into locked from public.oj_ledger_locks where organization_id = p_org;
  if locked is not null and p_date <= locked then raise exception 'That period is locked through %', locked; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 or jsonb_array_length(p_lines) > 60 then raise exception 'An entry needs between 2 and 60 lines'; end if;
  for item in select * from jsonb_array_elements(p_lines) loop
    d := coalesce((item->>'debit_cents')::bigint, 0); c := coalesce((item->>'credit_cents')::bigint, 0);
    if d < 0 or c < 0 or (d > 0) = (c > 0) then raise exception 'Each line must be a positive debit or a positive credit, not both'; end if;
    deb := deb + d; cred := cred + c;
  end loop;
  if deb <> cred then raise exception 'Entry is not balanced: debits % cents, credits % cents', deb, cred; end if;
  insert into public.oj_journal_entries(organization_id, entry_date, memo, source_type, source_id, idempotency_key)
    values (p_org, p_date, coalesce(p_memo, ''), coalesce(p_source_type, 'manual'), p_source_id, p_key) returning id into entry;
  for item in select * from jsonb_array_elements(p_lines) loop
    select id, active into acct from public.oj_accounts where organization_id = p_org and id = (item->>'account_id')::uuid;
    if not found then raise exception 'Unknown account'; end if;
    if not acct.active then raise exception 'That account is inactive'; end if;
    insert into public.oj_journal_lines(organization_id, entry_id, account_id, division, debit_cents, credit_cents, memo)
      values (p_org, entry, acct.id, item->>'division', coalesce((item->>'debit_cents')::bigint, 0), coalesce((item->>'credit_cents')::bigint, 0), coalesce(item->>'memo', ''));
  end loop;
  return entry;
end $$;

create function public.oj_post_journal(p_org uuid, p_date date, p_memo text, p_source_type text, p_source_id uuid, p_key text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_source_type, 'manual') not in ('manual','job','expense','bank','payout','opening') then raise exception 'That entry type is posted by its own function'; end if;
  if p_key is not null and (p_key like 'inv-issue:%' or p_key like 'pay:%' or p_key like 'inv-void:%') then raise exception 'That idempotency key prefix is reserved'; end if;
  return oj_private.post_journal(p_org, p_date, p_memo, coalesce(p_source_type, 'manual'), p_source_id, p_key, p_lines);
end $$;

-- Undo an entry by posting its mirror image. An entry can be reversed once; a reversal cannot itself be reversed.
-- Internal worker: p_system lets the invoice functions reverse invoice entries; the public wrapper below never does.
create function oj_private.reverse_journal(p_org uuid, p_entry uuid, p_date date, p_memo text, p_key text, p_system boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare original public.oj_journal_entries; entry uuid; locked date; hit record;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_key is not null then
    select id, reversal_of into hit from public.oj_journal_entries where organization_id = p_org and idempotency_key = p_key;
    if found then
      if hit.reversal_of is distinct from p_entry then raise exception 'That idempotency key was already used for a different entry'; end if;
      return hit.id;
    end if;
  end if;
  select * into original from public.oj_journal_entries where organization_id = p_org and id = p_entry;
  if not found then raise exception 'Entry not found'; end if;
  if not p_system and original.source_type in ('invoice', 'payment') then raise exception 'Invoice and payment entries are undone through the invoice functions'; end if;
  if original.reversal_of is not null then raise exception 'A reversal cannot be reversed'; end if;
  if exists (select 1 from public.oj_journal_entries where organization_id = p_org and reversal_of = p_entry) then raise exception 'That entry was already reversed'; end if;
  select locked_through into locked from public.oj_ledger_locks where organization_id = p_org;
  if locked is not null and p_date <= locked then raise exception 'That period is locked through %', locked; end if;
  insert into public.oj_journal_entries(organization_id, entry_date, memo, source_type, source_id, idempotency_key, reversal_of)
    values (p_org, p_date, coalesce(nullif(p_memo, ''), 'Reversal of ' || original.id::text), 'reversal', original.source_id, p_key, original.id) returning id into entry;
  insert into public.oj_journal_lines(organization_id, entry_id, account_id, division, debit_cents, credit_cents, memo)
    select organization_id, entry, account_id, division, credit_cents, debit_cents, memo from public.oj_journal_lines where organization_id = p_org and entry_id = original.id;
  return entry;
end $$;

create function public.oj_reverse_journal(p_org uuid, p_entry uuid, p_date date, p_memo text, p_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if p_key is not null and (p_key like 'inv-issue:%' or p_key like 'pay:%' or p_key like 'inv-void:%') then raise exception 'That idempotency key prefix is reserved'; end if;
  return oj_private.reverse_journal(p_org, p_entry, p_date, p_memo, p_key, false);
end $$;

-- Owners only: lock the books through a date (month-end close). Dates only move forward.
create function public.oj_lock_period(p_org uuid, p_through date) returns date language plpgsql security definer set search_path = '' as $$
declare current_lock date;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') <> 'owner' then raise exception 'Owner access required'; end if;
  select locked_through into current_lock from public.oj_ledger_locks where organization_id = p_org;
  if current_lock is not null and p_through < current_lock then raise exception 'A locked period cannot be reopened'; end if;
  insert into public.oj_ledger_locks(organization_id, locked_through) values (p_org, p_through)
    on conflict (organization_id) do update set locked_through = excluded.locked_through, locked_by = auth.uid(), locked_at = now();
  return p_through;
end $$;

-- Owners only: start the chart of accounts for a company that has none yet.
create function public.oj_seed_chart(p_org uuid) returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') <> 'owner' then raise exception 'Owner access required'; end if;
  if exists (select 1 from public.oj_accounts where organization_id = p_org) then raise exception 'This company already has a chart of accounts'; end if;
  insert into public.oj_accounts(organization_id, code, name, type) select p_org, v.code, v.name, v.type from (values
    ('1000','Mercury - Operating','asset'), ('1010','Mercury - Revenue Clearing','asset'), ('1020','Mercury - Tax Reserve','asset'), ('1030','Mercury - Truck Fund','asset'),
    ('1100','Accounts Receivable','asset'), ('1150','Undeposited Funds (checks and card payouts)','asset'), ('1200','Equipment','asset'), ('1210','Vehicles','asset'),
    ('2000','Credit Card','liability'), ('2100','Sales Tax Payable','liability'), ('2200','Customer Deposits','liability'),
    ('3000','Opening Balance Equity','equity'), ('3010','Oscar - Capital','equity'), ('3020','Jacob - Capital','equity'), ('3110','Oscar - Draws','equity'), ('3120','Jacob - Draws','equity'),
    ('4000','Exterior - Residential Services','income'), ('4010','Exterior - Commercial Services','income'), ('4100','Solutions - Setup Fees','income'), ('4110','Solutions - Monthly Fees','income'),
    ('4200','Essentials - Product Sales','income'), ('4900','Other Income','income'),
    ('5000','Chemicals and Supplies','cogs'), ('5010','Crew Commission','cogs'), ('5020','Fuel','cogs'), ('5030','Equipment Repair','cogs'), ('5040','Equipment Rental','cogs'), ('5100','Essentials - Cost of Goods','cogs'),
    ('6000','Advertising - Local Services Ads','expense'), ('6010','Advertising - Other','expense'), ('6100','Insurance','expense'), ('6110','Software and Subscriptions','expense'),
    ('6120','Phone and Internet','expense'), ('6130','Payment Processing Fees','expense'), ('6140','Licenses, Fees and Taxes','expense'), ('6900','Depreciation','expense'), ('6990','Miscellaneous','expense')
  ) as v(code, name, type);
  get diagnostics n = row_count;
  return n;
end $$;

-- Trial balance as of a date, through the caller's own access (security invoker: row-level security applies).
create function public.oj_trial_balance(p_org uuid, p_through date)
returns table (account_id uuid, code text, name text, type text, debit_cents bigint, credit_cents bigint)
language sql stable security invoker set search_path = '' as $$
  select a.id, a.code, a.name, a.type,
         coalesce(sum(l.debit_cents), 0)::bigint, coalesce(sum(l.credit_cents), 0)::bigint
  from public.oj_accounts a
  left join public.oj_journal_entries e on e.organization_id = a.organization_id and e.entry_date <= p_through
  left join public.oj_journal_lines l on l.organization_id = e.organization_id and l.entry_id = e.id and l.account_id = a.id
  where a.organization_id = p_org
  group by a.id, a.code, a.name, a.type
  order by a.code
$$;

revoke all on function public.oj_post_journal(uuid, date, text, text, uuid, text, jsonb), public.oj_reverse_journal(uuid, uuid, date, text, text),
  public.oj_lock_period(uuid, date), public.oj_seed_chart(uuid), public.oj_trial_balance(uuid, date) from public, anon;
grant execute on function public.oj_post_journal(uuid, date, text, text, uuid, text, jsonb), public.oj_reverse_journal(uuid, uuid, date, text, text),
  public.oj_lock_period(uuid, date), public.oj_seed_chart(uuid), public.oj_trial_balance(uuid, date) to authenticated;

revoke all on function oj_private.post_journal(uuid, date, text, text, uuid, text, jsonb), oj_private.reverse_journal(uuid, uuid, date, text, text, boolean) from public;
