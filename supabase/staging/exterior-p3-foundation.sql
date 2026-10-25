-- Exterior P3.1 STAGING CONTRACT — NOT an approved production migration.
-- Apply ONLY to a fresh disposable PostgreSQL 17 fixture or a separately
-- approved staging environment AFTER workspace.sql. Never auto-run on startup.
-- Production P2 backup/restore and actor acceptance remain required.
--
-- Legacy leads/bookings use their ORIGINAL TEXT IDs; this migration deliberately
-- does not force UUID conversions, merge customers, or change those tables.
-- No public SECURITY DEFINER functions or customer-facing send/approve RPC.
-- Direct API access is READ-ONLY and restricted to current owner/member.
-- Writes are reserved for a FUTURE reviewed, authenticated transactional adapter.

create schema if not exists oj_private;

create table public.oj_exterior_customers (
 organization_id uuid not null references public.oj_organizations(id),
 id uuid not null default gen_random_uuid(),
 display_name text not null check (length(btrim(display_name)) between 1 and 180),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (organization_id,id)
);

create table public.oj_exterior_properties (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 customer_id uuid not null,
 address_text text not null check (length(btrim(address_text)) between 4 and 300),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (organization_id,id),
 unique (organization_id,id,customer_id),
 foreign key (organization_id,customer_id)
  references public.oj_exterior_customers(organization_id,id)
);

-- Explicit, human-approved legacy source relation. One legacy lead maps to
-- ONE tenant/customer/property tuple. Never infer identity from phone/address.
create table public.oj_exterior_legacy_links (
 organization_id uuid not null,
 legacy_lead_id text not null check (length(btrim(legacy_lead_id)) between 1 and 128),
 customer_id uuid not null,
 property_id uuid not null,
 linked_by uuid not null references auth.users(id),
 linked_at timestamptz not null default now(),
 primary key (organization_id,legacy_lead_id),
 unique (organization_id,legacy_lead_id,customer_id,property_id),
 foreign key (organization_id,property_id,customer_id)
  references public.oj_exterior_properties(organization_id,id,customer_id)
);

create table public.oj_exterior_opportunities (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 customer_id uuid not null,
 property_id uuid not null,
 legacy_lead_id text not null,
 target_booking_id text check (
  target_booking_id is null or length(btrim(target_booking_id)) between 1 and 128
 ),
 revision integer not null default 0 check (revision>=0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (organization_id,id),
 foreign key (organization_id,legacy_lead_id,customer_id,property_id)
  references public.oj_exterior_legacy_links(
   organization_id,legacy_lead_id,customer_id,property_id
  )
);
create unique index oj_ext_one_opp_per_exact_visit
 on public.oj_exterior_opportunities(organization_id,legacy_lead_id,target_booking_id)
 where target_booking_id is not null;
create unique index oj_ext_one_open_opp_per_legacy_lead
 on public.oj_exterior_opportunities(organization_id,legacy_lead_id)
 where target_booking_id is null;

create table public.oj_exterior_quotes (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 opportunity_id uuid not null,
 revision integer not null default 0 check (revision>=0),
 latest_version_sequence integer not null default 0 check (latest_version_sequence>=0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (organization_id,id),
 unique (organization_id,opportunity_id),
 unique (organization_id,id,opportunity_id),
 foreign key (organization_id,opportunity_id)
  references public.oj_exterior_opportunities(organization_id,id)
);

create table public.oj_exterior_quote_versions (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 quote_id uuid not null,
 sequence integer not null check (sequence>0),
 command_id uuid not null,
 expected_revision integer not null check (expected_revision>=0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 source_updated_at text check (
  source_updated_at is null or length(source_updated_at)<=64
 ),
 source_quote_cents bigint check (
  source_quote_cents is null or source_quote_cents between 0 and 1000000000
 ),
 scope jsonb not null check (
  jsonb_typeof(scope)='array' and jsonb_array_length(scope) between 1 and 24
 ),
 subtotal_cents bigint not null check (subtotal_cents between 1 and 1000000000),
 discount_cents bigint not null check (discount_cents>=0),
 price_cents bigint not null check (price_cents>0 and price_cents=subtotal_cents-discount_cents),
 content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
 primary key (organization_id,id),
 unique (organization_id,quote_id,sequence),
 unique (organization_id,command_id),
 unique (organization_id,quote_id,id),
 foreign key (organization_id,quote_id)
  references public.oj_exterior_quotes(organization_id,id)
);

create table public.oj_exterior_quote_claims (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 quote_id uuid not null,
 version_id uuid not null,
 booking_id text check (booking_id is null or length(btrim(booking_id)) between 1 and 128),
 kind text not null check (
  kind in ('operator-report','provider-reference','signed-document-reference')
 ),
 reference text not null check (length(btrim(reference)) between 3 and 256),
 verification_state text not null default 'unverified'
  check (verification_state='unverified'),
 recorded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (organization_id,id),
 foreign key (organization_id,quote_id,version_id)
  references public.oj_exterior_quote_versions(organization_id,quote_id,id)
);

-- No client reads, INSERT privileges, or public RPC wrappers. A future trusted
-- server adapter must independently verify provider signatures, customer
-- authority and replay protection BEFORE inserting a receipt.
create table oj_private.oj_exterior_verified_acceptances (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 quote_id uuid not null,
 version_id uuid not null,
 booking_id text not null check (length(btrim(booking_id)) between 1 and 128),
 content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
 price_cents bigint not null check (price_cents>0),
 issuer text not null check (length(btrim(issuer)) between 3 and 120),
 provider_event_id text not null check (length(btrim(provider_event_id)) between 8 and 256),
 verified_at timestamptz not null,
 consumed_at timestamptz,
 primary key (organization_id,id),
 unique (organization_id,issuer,provider_event_id),
 unique (organization_id,id,quote_id,version_id,booking_id),
 foreign key (organization_id,quote_id,version_id)
  references public.oj_exterior_quote_versions(organization_id,quote_id,id)
);

create table public.oj_exterior_work_orders (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 opportunity_id uuid not null,
 quote_id uuid not null,
 version_id uuid not null,
 booking_id text not null check (length(btrim(booking_id)) between 1 and 128),
 verified_receipt_id uuid not null,
 price_cents bigint not null check (price_cents>0),
 scope_snapshot jsonb not null check (
  jsonb_typeof(scope_snapshot)='array' and jsonb_array_length(scope_snapshot) between 1 and 24
 ),
 status text not null default 'planned' check (status='planned'),
 created_at timestamptz not null default now(),
 primary key (organization_id,id),
 unique (organization_id,booking_id),
 unique (organization_id,verified_receipt_id),
 unique (organization_id,quote_id,version_id),
 foreign key (organization_id,quote_id,opportunity_id)
  references public.oj_exterior_quotes(organization_id,id,opportunity_id),
 foreign key (organization_id,quote_id,version_id)
  references public.oj_exterior_quote_versions(organization_id,quote_id,id),
 foreign key (
  organization_id,verified_receipt_id,quote_id,version_id,booking_id
 ) references oj_private.oj_exterior_verified_acceptances(
  organization_id,id,quote_id,version_id,booking_id
 )
);

create table public.oj_exterior_order_events (
 organization_id uuid not null,
 id uuid not null default gen_random_uuid(),
 work_order_id uuid not null,
 actor_id uuid not null references auth.users(id),
 event_kind text not null check (
  event_kind in ('planned','scheduled','field_started','field_completed','owner_review','voided')
 ),
 explanation text not null default '' check (length(explanation)<=1200),
 created_at timestamptz not null default now(),
 primary key (organization_id,id),
 foreign key (organization_id,work_order_id)
  references public.oj_exterior_work_orders(organization_id,id)
);

-- Tight default-deny policy and explicit Data API grants. No API write grants
-- exist yet, even for founders. A service-role-free, audited transactional
-- adapter is a separate release, not an accidental table Editor permission.
alter table public.oj_exterior_customers enable row level security;
alter table public.oj_exterior_properties enable row level security;
alter table public.oj_exterior_legacy_links enable row level security;
alter table public.oj_exterior_opportunities enable row level security;
alter table public.oj_exterior_quotes enable row level security;
alter table public.oj_exterior_quote_versions enable row level security;
alter table public.oj_exterior_quote_claims enable row level security;
alter table oj_private.oj_exterior_verified_acceptances enable row level security;
alter table public.oj_exterior_work_orders enable row level security;
alter table public.oj_exterior_order_events enable row level security;

revoke all on
 public.oj_exterior_customers,public.oj_exterior_properties,
 public.oj_exterior_legacy_links,public.oj_exterior_opportunities,
 public.oj_exterior_quotes,public.oj_exterior_quote_versions,
 public.oj_exterior_quote_claims,public.oj_exterior_work_orders,
 public.oj_exterior_order_events
 from public,anon,authenticated;
revoke all on oj_private.oj_exterior_verified_acceptances
 from public,anon,authenticated;

grant select on
 public.oj_exterior_customers,public.oj_exterior_properties,
 public.oj_exterior_legacy_links,public.oj_exterior_opportunities,
 public.oj_exterior_quotes,public.oj_exterior_quote_versions,
 public.oj_exterior_quote_claims,public.oj_exterior_work_orders,
 public.oj_exterior_order_events
 to authenticated;

create policy ext_customer_read on public.oj_exterior_customers
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_property_read on public.oj_exterior_properties
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_legacy_link_read on public.oj_exterior_legacy_links
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_opportunity_read on public.oj_exterior_opportunities
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_quote_read on public.oj_exterior_quotes
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_version_read on public.oj_exterior_quote_versions
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_claim_read on public.oj_exterior_quote_claims
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_work_order_read on public.oj_exterior_work_orders
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));
create policy ext_order_event_read on public.oj_exterior_order_events
 for select to authenticated
 using (oj_private.member_role(organization_id) in ('owner','member'));

-- Defense in depth: immutable history cannot be rewritten, even by a future
-- privileged writer. Manual corrections require explicit append-only receipts.
create function oj_private.ext_p3_reject_change() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'P3 immutable evidence cannot be changed or deleted'
  using errcode='23514';
end;
$$;
revoke all on function oj_private.ext_p3_reject_change() from public,anon,authenticated;

create trigger ext_legacy_link_immutable
 before update or delete on public.oj_exterior_legacy_links
 for each row execute function oj_private.ext_p3_reject_change();
create trigger ext_quote_version_immutable
 before update or delete on public.oj_exterior_quote_versions
 for each row execute function oj_private.ext_p3_reject_change();
create trigger ext_quote_claim_immutable
 before update or delete on public.oj_exterior_quote_claims
 for each row execute function oj_private.ext_p3_reject_change();
create trigger ext_work_order_immutable
 before update or delete on public.oj_exterior_work_orders
 for each row execute function oj_private.ext_p3_reject_change();
create trigger ext_order_event_immutable
 before update or delete on public.oj_exterior_order_events
 for each row execute function oj_private.ext_p3_reject_change();

-- Enforce exact optimistic revision, serially per quote, and current version.
-- This is a trigger, not a public approval RPC. Future server transactions
-- must still verify original leads, customer permissions and provider proof.
create function oj_private.ext_p3_append_version() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare current_revision integer; current_sequence integer; line jsonb;
 total_line_cents numeric:=0;
begin
 select q.revision,q.latest_version_sequence
 into current_revision,current_sequence
 from public.oj_exterior_quotes q
 where q.organization_id=new.organization_id and q.id=new.quote_id
 for update;
 if not found or new.expected_revision<>current_revision or
    new.sequence<>current_sequence+1 then
  raise exception 'Quote version conflict or nonsequential version'
   using errcode='40001';
 end if;
 for line in select value from pg_catalog.jsonb_array_elements(new.scope) loop
  if pg_catalog.jsonb_typeof(line)<>'object' or
     pg_catalog.jsonb_typeof(line->'id')<>'string' or
     pg_catalog.length(line->>'id') not between 1 and 80 or
     pg_catalog.jsonb_typeof(line->'service')<>'string' or
     pg_catalog.length(pg_catalog.btrim(line->>'service')) not between 1 and 120 or
     pg_catalog.jsonb_typeof(line->'unit')<>'string' or
     line->>'unit' not in ('flat','each','sqft','linear_ft','pane','hour') or
     pg_catalog.jsonb_typeof(line->'quantity')<>'number' or
     (line->>'quantity')::numeric<=0 or
     (line->>'quantity')::numeric>100000 or
     pg_catalog.jsonb_typeof(line->'unitPriceCents')<>'number' or
     (line->>'unitPriceCents')::numeric<0 or
     (line->>'unitPriceCents')::numeric>100000000 or
     (line ? 'notes' and (
       pg_catalog.jsonb_typeof(line->'notes')<>'string' or
       pg_catalog.length(line->>'notes')>800
     )) or exists(
       select 1 from pg_catalog.jsonb_object_keys(line) as k(key_name)
       where key_name not in ('id','service','unit','quantity','unitPriceCents','notes')
     )
  then raise exception 'Invalid public quote scope line or private field leakage'
   using errcode='23514';
  end if;
  total_line_cents:=total_line_cents+
    (line->>'quantity')::numeric*(line->>'unitPriceCents')::numeric;
 end loop;
 if pg_catalog.round(total_line_cents)::bigint<>new.subtotal_cents then
  raise exception 'Customer quote line totals do not match immutable subtotal'
   using errcode='23514';
 end if;
 update public.oj_exterior_quotes
 set latest_version_sequence=new.sequence,revision=current_revision+1
 where organization_id=new.organization_id and id=new.quote_id;
 return new;
end;
$$;
revoke all on function oj_private.ext_p3_append_version() from public,anon,authenticated;
create trigger ext_quote_version_append
 before insert on public.oj_exterior_quote_versions
 for each row execute function oj_private.ext_p3_append_version();

-- Only consumed_at may transition from NULL to a timestamp exactly ONCE.
-- Issuer, external receipt identifier, version hash and paid amount can never
-- be rewritten, even by a future privileged writer.
create function oj_private.ext_p3_lock_verified_receipt() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' or
    (to_jsonb(new)-'consumed_at') is distinct from
      (to_jsonb(old)-'consumed_at') or
    old.consumed_at is not null or new.consumed_at is null then
  raise exception 'Verified acceptance receipt identity is immutable'
   using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function oj_private.ext_p3_lock_verified_receipt()
 from public,anon,authenticated;
create trigger ext_verified_acceptance_immutable
 before update or delete on oj_private.oj_exterior_verified_acceptances
 for each row execute function oj_private.ext_p3_lock_verified_receipt();

-- A real work order consumes an independently verified private receipt once,
-- in the SAME transaction. All client-readable acceptance claims are excluded.
-- This trigger cannot verify a provider signature: receipt insertion must be
-- performed by a separate trusted adapter after independent verification.
create function oj_private.ext_p3_guard_work_order() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare
 v record; q record; o record; a record;
begin
 select * into q from public.oj_exterior_quotes
  where organization_id=new.organization_id and id=new.quote_id
    and opportunity_id=new.opportunity_id for update;
 select * into v from public.oj_exterior_quote_versions
  where organization_id=new.organization_id and id=new.version_id
    and quote_id=new.quote_id;
 select * into o from public.oj_exterior_opportunities
  where organization_id=new.organization_id and id=new.opportunity_id;
 select * into a from oj_private.oj_exterior_verified_acceptances
  where organization_id=new.organization_id and id=new.verified_receipt_id
  for update;
 if q.id is null or v.id is null or o.id is null or a.id is null or
    o.target_booking_id is null or o.target_booking_id<>new.booking_id or
    q.latest_version_sequence<>v.sequence or
    v.content_hash<>a.content_hash or
    v.price_cents<>a.price_cents or
    new.price_cents<>v.price_cents or
    new.scope_snapshot<>v.scope or
    a.quote_id<>new.quote_id or a.version_id<>new.version_id or
    a.booking_id<>new.booking_id or
    a.consumed_at is not null then
  raise exception 'Work order is stale, unsupported or lacks a fresh verified acceptance'
   using errcode='23514';
 end if;
 update oj_private.oj_exterior_verified_acceptances
 set consumed_at=now()
 where organization_id=new.organization_id and id=new.verified_receipt_id
   and consumed_at is null;
 if not found then
  raise exception 'Verified acceptance was already consumed' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function oj_private.ext_p3_guard_work_order() from public,anon,authenticated;
create trigger ext_work_order_verified_receipt
 before insert on public.oj_exterior_work_orders
 for each row execute function oj_private.ext_p3_guard_work_order();

comment on table public.oj_exterior_work_orders is
 'STAGING ONLY. A work order requires a trusted server verified acceptance, latest immutable quote version, exact booking and atomic private receipt consumption; never client Insert.';
comment on table oj_private.oj_exterior_verified_acceptances is
 'PRIVATE provider-verified acceptance staging ledger. Not a client-accessible approval or claim table.';
