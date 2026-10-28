-- OJ OS: customers and properties (master plan 4.2, 6.2 and 6.15 "property memory").
-- Today a customer and a job are the same row (public.leads), so a returning client is several rows and a site has nowhere to keep its gate code or water source.
-- This adds, beside the old data and without changing it:
--   oj_customers   one person or company (a returning client is ONE customer with many jobs)
--   oj_properties  a site belonging to a customer, with access, water and surface notes
--   oj_lead_links  which customer and property each existing lead (job) belongs to
-- and four functions: oj_backfill_customers (builds customers from the existing leads, matching by phone, then name plus address; safe to run again),
-- oj_link_lead, oj_merge_customers, and the key helpers. Additive only. Run once in the Supabase SQL editor, then press Sync customers on the Customers page.
-- Until it is run, the Customers page says it is not switched on yet and nothing breaks.
begin;

-- A phone number reduced to its last ten digits, or null when it is a placeholder or too short to match on.
create function oj_private.phone_key(p text) returns text language sql immutable set search_path = '' as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10 then right(regexp_replace(p, '\D', '', 'g'), 10) end
$$;
create function oj_private.address_key(p text) returns text language sql immutable set search_path = '' as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '')
$$;
revoke all on function oj_private.phone_key(text), oj_private.address_key(text) from public;

-- The old Exterior Care leads belong to exactly one workspace (recorded in oj_private.legacy_owner when exterior-read.sql was applied).
-- Only that workspace may build customers from them or link them; any other workspace is refused, so one company's customers can never be copied into another's.
-- If that table does not exist the functions fail closed.
create function oj_private.owns_legacy_leads(p_org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from oj_private.legacy_owner where organization_id = p_org)
$$;
revoke all on function oj_private.owns_legacy_leads(uuid) from public;

create table public.oj_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  kind text not null default 'person' check (kind in ('person','company')),
  name text not null check (length(btrim(name)) between 1 and 200),
  phone text check (phone is null or length(phone) <= 40),
  phone_key text,
  email text check (email is null or length(email) <= 200),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index oj_customers_phone on public.oj_customers(organization_id, phone_key) where phone_key is not null;
create index oj_customers_name on public.oj_customers(organization_id, lower(name));
create index oj_customers_created_by on public.oj_customers(created_by);

create table public.oj_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  customer_id uuid not null,
  label text not null default '' check (length(label) <= 80),
  address text not null check (length(btrim(address)) between 1 and 500),
  address_key text,
  -- Property memory: what the next crew member needs to know without calling anyone.
  access_notes text not null default '' check (length(access_notes) <= 1000),
  water_notes text not null default '' check (length(water_notes) <= 500),
  surface_notes text not null default '' check (length(surface_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, customer_id) references public.oj_customers(organization_id, id)
);
create index oj_properties_customer on public.oj_properties(organization_id, customer_id);
create index oj_properties_address on public.oj_properties(organization_id, address_key) where address_key is not null;

create table public.oj_lead_links (
  lead_id uuid primary key,   -- public.leads.id; no foreign key, that table belongs to the original Exterior Care app
  organization_id uuid not null references public.oj_organizations(id),
  customer_id uuid not null,
  property_id uuid,
  foreign key (organization_id, customer_id) references public.oj_customers(organization_id, id),
  foreign key (organization_id, property_id) references public.oj_properties(organization_id, id)
);
create index oj_lead_links_customer on public.oj_lead_links(organization_id, customer_id);
create index oj_lead_links_property on public.oj_lead_links(organization_id, property_id) where property_id is not null;

-- Keep the match keys and the edit time right whatever wrote the row. These run with the owner's rights so a member's own edit can reach the helpers; they read no data.
create function oj_private.customer_keys() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.phone_key := oj_private.phone_key(new.phone);
  new.updated_at := now();
  return new;
end $$;
create function oj_private.property_keys() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.address_key := oj_private.address_key(new.address);
  new.updated_at := now();
  return new;
end $$;
revoke all on function oj_private.customer_keys(), oj_private.property_keys() from public;
create trigger customers_keys before insert or update on public.oj_customers for each row execute function oj_private.customer_keys();
create trigger properties_keys before insert or update on public.oj_properties for each row execute function oj_private.property_keys();

alter table public.oj_customers enable row level security;
alter table public.oj_properties enable row level security;
alter table public.oj_lead_links enable row level security;
revoke all on public.oj_customers, public.oj_properties, public.oj_lead_links from public, anon, authenticated;
grant select, insert on public.oj_customers, public.oj_properties to authenticated;
grant update (kind, name, phone, email, notes) on public.oj_customers to authenticated;
grant update (label, address, access_notes, water_notes, surface_notes) on public.oj_properties to authenticated;
grant select on public.oj_lead_links to authenticated;
-- Customer records are business data, like the leads they come from: owners and members only, view-only members do not see them.
create policy customers_read on public.oj_customers for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));
create policy customers_add on public.oj_customers for insert to authenticated with check (oj_private.member_role(organization_id) in ('owner','member') and created_by = (select auth.uid()));
create policy customers_change on public.oj_customers for update to authenticated using (oj_private.member_role(organization_id) in ('owner','member')) with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy properties_read on public.oj_properties for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));
create policy properties_add on public.oj_properties for insert to authenticated with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy properties_change on public.oj_properties for update to authenticated using (oj_private.member_role(organization_id) in ('owner','member')) with check (oj_private.member_role(organization_id) in ('owner','member'));
create policy links_read on public.oj_lead_links for select to authenticated using (oj_private.member_role(organization_id) in ('owner','member'));

-- Builds customers, properties and links from the leads that are not linked yet. A lead joins an existing customer when the phone number matches
-- (last ten digits), else when the same name is already at the same address; otherwise it becomes a new customer. Each distinct address becomes
-- one property. Placeholder numbers (NP_..., NO_PHONE) never match. Running it again only handles leads added since.
create function public.oj_backfill_customers(p_org uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; cust uuid; prop uuid; pk text; ak text; nm text; made_c integer := 0; made_p integer := 0; linked integer := 0;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if not oj_private.owns_legacy_leads(p_org) then raise exception 'Only the workspace that owns the Exterior Care records can build customers from them'; end if;
  for r in select l.id, l.name, l.phone, l.address from public.leads l where not exists (select 1 from public.oj_lead_links k where k.lead_id = l.id) order by l.created_at, l.id loop
    pk := oj_private.phone_key(r.phone);
    ak := oj_private.address_key(r.address);
    nm := coalesce(nullif(btrim(r.name), ''), 'Unnamed customer');
    cust := null; prop := null;
    if pk is not null then
      select id into cust from public.oj_customers where organization_id = p_org and phone_key = pk order by created_at limit 1;
    end if;
    if cust is null and ak is not null and nm <> 'Unnamed customer' then
      select c.id into cust from public.oj_customers c join public.oj_properties p on p.organization_id = c.organization_id and p.customer_id = c.id
        where c.organization_id = p_org and lower(btrim(c.name)) = lower(nm) and p.address_key = ak order by c.created_at limit 1;
    end if;
    if cust is null then
      insert into public.oj_customers(organization_id, name, phone) values (p_org, left(nm, 200), nullif(left(coalesce(r.phone, ''), 40), '')) returning id into cust;
      made_c := made_c + 1;
    end if;
    if ak is not null then
      select id into prop from public.oj_properties where organization_id = p_org and customer_id = cust and address_key = ak limit 1;
      if prop is null then
        insert into public.oj_properties(organization_id, customer_id, address) values (p_org, cust, left(btrim(r.address), 500)) returning id into prop;
        made_p := made_p + 1;
      end if;
    end if;
    insert into public.oj_lead_links(lead_id, organization_id, customer_id, property_id) values (r.id, p_org, cust, prop);
    linked := linked + 1;
  end loop;
  return jsonb_build_object('customers', made_c, 'properties', made_p, 'linked', linked);
end $$;

-- Moves one lead (job) to another customer, and optionally to one of that customer's properties.
create function public.oj_link_lead(p_org uuid, p_lead uuid, p_customer uuid, p_property uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if not oj_private.owns_legacy_leads(p_org) then raise exception 'Only the workspace that owns the Exterior Care records can link them'; end if;
  if not exists (select 1 from public.leads where id = p_lead) then raise exception 'That job does not exist'; end if;
  if not exists (select 1 from public.oj_customers where organization_id = p_org and id = p_customer) then raise exception 'Customer not found'; end if;
  if p_property is not null and not exists (select 1 from public.oj_properties where organization_id = p_org and id = p_property and customer_id = p_customer) then raise exception 'That property does not belong to this customer'; end if;
  insert into public.oj_lead_links(lead_id, organization_id, customer_id, property_id) values (p_lead, p_org, p_customer, p_property)
    on conflict (lead_id) do update set customer_id = excluded.customer_id, property_id = excluded.property_id where public.oj_lead_links.organization_id = p_org;
end $$;

-- Merges a duplicate customer into the one to keep: its properties and jobs move over, then it is removed.
create function public.oj_merge_customers(p_org uuid, p_keep uuid, p_remove uuid) returns void language plpgsql security definer set search_path = '' as $$
declare k public.oj_customers; d public.oj_customers;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_org), '') not in ('owner', 'member') then raise exception 'Workspace member access required'; end if;
  if p_keep = p_remove then raise exception 'Choose two different customers'; end if;
  select * into k from public.oj_customers where organization_id = p_org and id = p_keep for update;
  select * into d from public.oj_customers where organization_id = p_org and id = p_remove for update;
  if k.id is null or d.id is null then raise exception 'Customer not found'; end if;
  update public.oj_properties set customer_id = p_keep where organization_id = p_org and customer_id = p_remove;
  update public.oj_lead_links set customer_id = p_keep where organization_id = p_org and customer_id = p_remove;
  update public.oj_customers set phone = coalesce(phone, d.phone), email = coalesce(email, d.email),
    notes = case when d.notes = '' then notes when notes = '' then d.notes else left(notes || E'\n[Merged] ' || d.notes, 2000) end where id = p_keep;
  delete from public.oj_customers where id = p_remove;
end $$;

revoke all on function public.oj_backfill_customers(uuid), public.oj_link_lead(uuid, uuid, uuid, uuid), public.oj_merge_customers(uuid, uuid, uuid) from public, anon;
grant execute on function public.oj_backfill_customers(uuid), public.oj_link_lead(uuid, uuid, uuid, uuid), public.oj_merge_customers(uuid, uuid, uuid) to authenticated;

commit;
