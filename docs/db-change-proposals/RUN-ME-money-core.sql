-- OJ OS money core: double-entry ledger + invoices and payments. NOT APPLIED. Run only with Oscar's OK, after a backup.
-- Run once in the Supabase SQL editor for the OJ EXTERIOR CARE LEADS project.
--
-- Additive only: creates new tables (accounts, journal, invoices, payments and helpers) and functions. It changes no existing table or row.
-- It stops with an error, changing nothing, if the ledger already exists.
-- After it succeeds, an owner starts the chart of accounts from the app (or runs: select public.oj_seed_chart('<your organization id>');).
-- Tested in tests/ledger-core-sql.test.ts and tests/invoices-sql.test.ts (24 checks on a real Postgres engine).
-- To undo (only before real data is posted): drop the tables public.oj_payments, oj_invoice_lines, oj_invoices, oj_invoice_counters,
-- oj_journal_lines, oj_journal_entries, oj_ledger_locks, oj_accounts (cascade) and the oj_* functions listed in the two source files.

begin;
do $$ begin
  if to_regclass('public.oj_journal_entries') is not null or to_regclass('public.oj_accounts') is not null then
    raise exception 'The ledger already exists. Nothing changed.';
  end if;
end $$;

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

-- Post one balanced entry. p_lines: [{"account_id": uuid, "division": text, "debit_cents": int, "credit_cents": int, "memo": text}, ...]
create function public.oj_post_journal(p_org uuid, p_date date, p_memo text, p_source_type text, p_source_id uuid, p_key text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare entry uuid; item jsonb; deb bigint := 0; cred bigint := 0; locked date; acct record; d bigint; c bigint;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_date is null then raise exception 'Choose an entry date'; end if;
  if p_key is not null then
    select id into entry from public.oj_journal_entries where organization_id = p_org and idempotency_key = p_key;
    if found then return entry; end if;
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

-- Undo an entry by posting its mirror image. An entry can be reversed once; a reversal cannot itself be reversed.
create function public.oj_reverse_journal(p_org uuid, p_entry uuid, p_date date, p_memo text, p_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare original public.oj_journal_entries; entry uuid; locked date;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_key is not null then
    select id into entry from public.oj_journal_entries where organization_id = p_org and idempotency_key = p_key;
    if found then return entry; end if;
  end if;
  select * into original from public.oj_journal_entries where organization_id = p_org and id = p_entry;
  if not found then raise exception 'Entry not found'; end if;
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

-- OJ OS money core, part 2: invoices and payments, posted to the ledger. Staged here (not in supabase/schemas) so the guarded deployer is not blocked; promote to supabase/schemas when it is applied. Additive, NOT applied to the live project.
-- Apply after ledger-core.sql (which itself comes after workspace.sql). A founder reviews and applies it only after a real backup.
--
-- Invoices are issued and paid only through the functions below, so an invoice, its lines and its ledger entries always agree:
--   issue    : Dr Accounts Receivable (1100) / Cr the income account on each line, tagged with the division.
--   payment  : Dr the deposit account (card and check -> 1150 Undeposited Funds, ACH/Zelle/Venmo -> 1010 Revenue Clearing, cash -> 1150) / Cr Accounts Receivable.
--   void     : only while nothing has been paid; posts the reversal of the issue entry.
-- Sales tax is not calculated here (the Wisconsin treatment of exterior cleaning is still unconfirmed); tax_cents stays 0 until a CPA says otherwise.
-- Invoice numbers count up per company and year (INV-2026-0001). Retrying with the same idempotency key returns the original record.

create table public.oj_invoice_counters (
  organization_id uuid not null references public.oj_organizations(id),
  year integer not null,
  last_number integer not null default 0,
  primary key (organization_id, year)
);

create table public.oj_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  number text not null,
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 1 and 200),
  division text not null check (division in ('exterior','solutions','essentials','content','shared')),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 200),
  customer_email text check (customer_email is null or length(customer_email) <= 200),
  bill_to text not null default '' check (length(bill_to) <= 500),
  lead_id uuid,
  status text not null default 'open' check (status in ('open','paid','void')),
  issue_date date not null,
  due_date date not null,
  terms text not null default '' check (length(terms) <= 200),
  notes text not null default '' check (length(notes) <= 2000),
  subtotal_cents bigint not null check (subtotal_cents > 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null check (total_cents > 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0 and paid_cents <= total_cents),
  issue_entry_id uuid,
  void_entry_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (due_date >= issue_date),
  check (total_cents = subtotal_cents + tax_cents),
  unique (organization_id, id),
  unique (organization_id, number),
  foreign key (organization_id, issue_entry_id) references public.oj_journal_entries(organization_id, id),
  foreign key (organization_id, void_entry_id) references public.oj_journal_entries(organization_id, id)
);
create unique index oj_invoices_key on public.oj_invoices(organization_id, idempotency_key) where idempotency_key is not null;
create index oj_invoices_status on public.oj_invoices(organization_id, status, due_date);
create index oj_invoices_lead on public.oj_invoices(organization_id, lead_id) where lead_id is not null;
create index oj_invoices_created_by on public.oj_invoices(created_by);

create table public.oj_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  invoice_id uuid not null,
  position integer not null check (position > 0),
  description text not null check (length(btrim(description)) between 1 and 300),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents > 0),
  amount_cents bigint not null check (amount_cents > 0),
  income_account_id uuid not null,
  foreign key (organization_id, invoice_id) references public.oj_invoices(organization_id, id),
  foreign key (organization_id, income_account_id) references public.oj_accounts(organization_id, id)
);
create index oj_invoice_lines_by_invoice on public.oj_invoice_lines(organization_id, invoice_id, position);
create index oj_invoice_lines_by_account on public.oj_invoice_lines(organization_id, income_account_id);

create table public.oj_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  invoice_id uuid not null,
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 1 and 200),
  amount_cents bigint not null check (amount_cents > 0),
  method text not null check (method in ('card','ach','check','cash','zelle','venmo','other')),
  received_on date not null,
  reference text not null default '' check (length(reference) <= 200),
  entry_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, invoice_id) references public.oj_invoices(organization_id, id),
  foreign key (organization_id, entry_id) references public.oj_journal_entries(organization_id, id)
);
create unique index oj_payments_key on public.oj_payments(organization_id, idempotency_key) where idempotency_key is not null;
create index oj_payments_by_invoice on public.oj_payments(organization_id, invoice_id);
create index oj_payments_by_entry on public.oj_payments(organization_id, entry_id);
create index oj_payments_created_by on public.oj_payments(created_by);

alter table public.oj_invoice_counters enable row level security;
alter table public.oj_invoices enable row level security;
alter table public.oj_invoice_lines enable row level security;
alter table public.oj_payments enable row level security;
revoke all on public.oj_invoice_counters, public.oj_invoices, public.oj_invoice_lines, public.oj_payments from public, anon, authenticated;
grant select on public.oj_invoices, public.oj_invoice_lines, public.oj_payments to authenticated;
create policy invoices_read on public.oj_invoices for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy invoice_lines_read on public.oj_invoice_lines for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy payments_read on public.oj_payments for select to authenticated using (oj_private.member_role(organization_id) is not null);
-- The counters table has RLS on and no policy: only the functions below touch it.

create function oj_private.account_by_code(p_org uuid, p_code text) returns uuid language plpgsql stable security definer set search_path = '' as $$
declare found_id uuid;
begin
  select id into found_id from public.oj_accounts where organization_id = p_org and code = p_code and active;
  if found_id is null then raise exception 'Chart of accounts is missing account %. Seed the chart first.', p_code; end if;
  return found_id;
end $$;
revoke all on function oj_private.account_by_code(uuid, text) from public;

-- p_customer: {"name": text, "email": text|null, "bill_to": text|null, "lead_id": uuid|null}
-- p_lines: [{"description": text, "quantity": number, "unit_price_cents": int, "income_account_id": uuid}, ...]
create function public.oj_issue_invoice(p_org uuid, p_key text, p_customer jsonb, p_division text, p_issue date, p_due date, p_terms text, p_notes text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv uuid; item jsonb; pos integer := 0; qty numeric; price bigint; amt bigint; total bigint := 0; n integer; yr integer; entry uuid; ar uuid;
        ledger jsonb := '[]'::jsonb; number_text text; acct uuid;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_key is not null then
    select id into inv from public.oj_invoices where organization_id = p_org and idempotency_key = p_key;
    if found then return inv; end if;
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 40 then raise exception 'An invoice needs between 1 and 40 lines'; end if;
  if p_issue is null or p_due is null or p_due < p_issue then raise exception 'The due date cannot be before the issue date'; end if;
  ar := oj_private.account_by_code(p_org, '1100');
  yr := extract(year from p_issue)::integer;
  insert into public.oj_invoice_counters(organization_id, year, last_number) values (p_org, yr, 1)
    on conflict (organization_id, year) do update set last_number = public.oj_invoice_counters.last_number + 1 returning last_number into n;
  number_text := 'INV-' || yr::text || '-' || lpad(n::text, 4, '0');
  for item in select * from jsonb_array_elements(p_lines) loop
    qty := (item->>'quantity')::numeric; price := (item->>'unit_price_cents')::bigint;
    if qty is null or qty <= 0 or price is null or price <= 0 then raise exception 'Each line needs a positive quantity and price'; end if;
    amt := round(qty * price)::bigint;
    if amt <= 0 then raise exception 'Each line must total more than zero'; end if;
    total := total + amt;
  end loop;
  insert into public.oj_invoices(organization_id, number, idempotency_key, division, customer_name, customer_email, bill_to, lead_id, issue_date, due_date, terms, notes, subtotal_cents, total_cents)
    values (p_org, number_text, p_key, p_division, p_customer->>'name', nullif(p_customer->>'email', ''), coalesce(p_customer->>'bill_to', ''), nullif(p_customer->>'lead_id', '')::uuid, p_issue, p_due, coalesce(p_terms, ''), coalesce(p_notes, ''), total, total)
    returning id into inv;
  ledger := jsonb_build_array(jsonb_build_object('account_id', ar, 'division', p_division, 'debit_cents', total, 'credit_cents', 0, 'memo', number_text));
  for item in select * from jsonb_array_elements(p_lines) loop
    pos := pos + 1;
    qty := (item->>'quantity')::numeric; price := (item->>'unit_price_cents')::bigint; amt := round(qty * price)::bigint;
    acct := (item->>'income_account_id')::uuid;
    if not exists (select 1 from public.oj_accounts where organization_id = p_org and id = acct and type = 'income' and active) then raise exception 'Each line must point at an active income account'; end if;
    insert into public.oj_invoice_lines(organization_id, invoice_id, position, description, quantity, unit_price_cents, amount_cents, income_account_id)
      values (p_org, inv, pos, item->>'description', qty, price, amt, acct);
    ledger := ledger || jsonb_build_array(jsonb_build_object('account_id', acct, 'division', p_division, 'debit_cents', 0, 'credit_cents', amt, 'memo', number_text));
  end loop;
  entry := public.oj_post_journal(p_org, p_issue, 'Invoice ' || number_text || ' to ' || (p_customer->>'name'), 'invoice', inv, case when p_key is null then null else 'inv-issue:' || p_key end, ledger);
  -- Only this function may point an invoice at its entry, and it does so once, in the same transaction.
  perform set_config('oj.allow_invoice_link', '1', true);
  update public.oj_invoices set issue_entry_id = entry where id = inv;
  return inv;
end $$;

create function public.oj_record_payment(p_org uuid, p_invoice uuid, p_amount_cents bigint, p_method text, p_received date, p_reference text, p_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.oj_invoices; pay uuid; deposit uuid; ar uuid; entry uuid; new_paid bigint;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_key is not null then
    select id into pay from public.oj_payments where organization_id = p_org and idempotency_key = p_key;
    if found then return pay; end if;
  end if;
  select * into inv from public.oj_invoices where organization_id = p_org and id = p_invoice for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status <> 'open' then raise exception 'Only an open invoice can take a payment'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Enter a payment amount above zero'; end if;
  if p_amount_cents > inv.total_cents - inv.paid_cents then raise exception 'That is more than the % cents still owed', inv.total_cents - inv.paid_cents; end if;
  if p_method not in ('card','ach','check','cash','zelle','venmo','other') then raise exception 'Choose a payment method'; end if;
  ar := oj_private.account_by_code(p_org, '1100');
  deposit := oj_private.account_by_code(p_org, case when p_method in ('ach','zelle','venmo') then '1010' else '1150' end);
  entry := public.oj_post_journal(p_org, p_received, 'Payment on ' || inv.number || ' (' || p_method || ')', 'payment', p_invoice, case when p_key is null then null else 'pay:' || p_key end,
    jsonb_build_array(
      jsonb_build_object('account_id', deposit, 'division', inv.division, 'debit_cents', p_amount_cents, 'credit_cents', 0, 'memo', inv.number),
      jsonb_build_object('account_id', ar, 'division', inv.division, 'debit_cents', 0, 'credit_cents', p_amount_cents, 'memo', inv.number)));
  insert into public.oj_payments(organization_id, invoice_id, idempotency_key, amount_cents, method, received_on, reference, entry_id)
    values (p_org, p_invoice, p_key, p_amount_cents, p_method, p_received, coalesce(p_reference, ''), entry) returning id into pay;
  new_paid := inv.paid_cents + p_amount_cents;
  perform set_config('oj.allow_invoice_link', '1', true);
  update public.oj_invoices set paid_cents = new_paid, status = case when new_paid = total_cents then 'paid' else 'open' end where id = p_invoice;
  return pay;
end $$;

create function public.oj_void_invoice(p_org uuid, p_invoice uuid, p_date date, p_reason text, p_key text) returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.oj_invoices; entry uuid;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  select * into inv from public.oj_invoices where organization_id = p_org and id = p_invoice for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status = 'void' then return inv.void_entry_id; end if;
  if inv.paid_cents > 0 then raise exception 'An invoice with payments cannot be voided'; end if;
  entry := public.oj_reverse_journal(p_org, inv.issue_entry_id, p_date, 'Void ' || inv.number || coalesce(': ' || nullif(p_reason, ''), ''), p_key);
  perform set_config('oj.allow_invoice_link', '1', true);
  update public.oj_invoices set status = 'void', void_entry_id = entry where id = p_invoice;
  return entry;
end $$;

-- Invoices change only through the functions above (they set oj.allow_invoice_link for the transaction); a direct update by anyone is refused.
create function oj_private.guard_invoice_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('oj.allow_invoice_link', true), '') <> '1' then raise exception 'Invoices change only through the invoice functions.'; end if;
  if new.organization_id <> old.organization_id or new.number <> old.number or new.total_cents <> old.total_cents or new.subtotal_cents <> old.subtotal_cents
     or new.customer_name <> old.customer_name or new.issue_date <> old.issue_date then raise exception 'An issued invoice cannot be edited. Void it and issue a new one.'; end if;
  return new;
end $$;
revoke all on function oj_private.guard_invoice_update() from public;
create trigger invoices_guard_update before update on public.oj_invoices for each row execute function oj_private.guard_invoice_update();
create function oj_private.invoice_children_append_only() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Invoice lines and payments are append-only.'; end $$;
revoke all on function oj_private.invoice_children_append_only() from public;
create trigger invoice_lines_append_only before update or delete on public.oj_invoice_lines for each row execute function oj_private.invoice_children_append_only();
create trigger payments_append_only before update or delete on public.oj_payments for each row execute function oj_private.invoice_children_append_only();
create trigger invoices_no_delete before delete on public.oj_invoices for each row execute function oj_private.invoice_children_append_only();

revoke all on function public.oj_issue_invoice(uuid, text, jsonb, text, date, date, text, text, jsonb), public.oj_record_payment(uuid, uuid, bigint, text, date, text, text),
  public.oj_void_invoice(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.oj_issue_invoice(uuid, text, jsonb, text, date, date, text, text, jsonb), public.oj_record_payment(uuid, uuid, bigint, text, date, text, text),
  public.oj_void_invoice(uuid, uuid, date, text, text) to authenticated;

commit;
