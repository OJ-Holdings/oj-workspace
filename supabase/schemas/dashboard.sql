-- Desired additive schema for the shared dashboard: messages, leads, money,
-- hand-logged metrics, calendar events and documents. Apply after workspace.sql
-- and collaboration.sql. Every table carries organization_id and is guarded by
-- oj_private.member_role, the same rule the task board uses: members and owners
-- read and write, viewers read, everyone else gets nothing.

create table public.oj_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  venture text check (venture in ('exterior','solutions','essentials')),
  author_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index oj_messages_org on public.oj_messages(organization_id, created_at desc);

create table public.oj_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  venture text not null check (venture in ('exterior','solutions','essentials')),
  name text not null check (length(btrim(name)) between 1 and 160),
  contact text not null default '' check (length(contact) <= 200),
  stage text not null default 'New' check (stage in ('New','Contacted','Qualified','Proposal','Won','Lost')),
  value numeric(12,2) check (value is null or (value >= 0 and value < 100000000)),
  source text not null default '' check (length(source) <= 120),
  notes text not null default '' check (length(notes) <= 4000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index oj_leads_org on public.oj_leads(organization_id, stage, created_at desc);

-- Money actually received or spent. A quote is not revenue; log it when it is paid.
create table public.oj_finance_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  venture text not null check (venture in ('exterior','solutions','essentials')),
  kind text not null check (kind in ('revenue','cost')),
  amount numeric(12,2) not null check (amount > 0 and amount < 100000000),
  occurred_on date not null,
  category text not null default '' check (length(category) <= 80),
  note text not null default '' check (length(note) <= 500),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index oj_finance_org on public.oj_finance_entries(organization_id, occurred_on desc);

-- Any number a founder wants to track that no connected system reports.
create table public.oj_metric_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  venture text not null check (venture in ('exterior','solutions','essentials')),
  label text not null check (length(btrim(label)) between 1 and 80),
  value numeric(14,2) not null,
  unit text not null default '' check (length(unit) <= 20),
  measured_on date not null,
  note text not null default '' check (length(note) <= 500),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index oj_metrics_org on public.oj_metric_entries(organization_id, venture, measured_on desc);

create table public.oj_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  venture text check (venture in ('exterior','solutions','essentials')),
  title text not null check (length(btrim(title)) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at >= starts_at),
  all_day boolean not null default false,
  location text not null default '' check (length(location) <= 200),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index oj_events_org on public.oj_events(organization_id, starts_at);

-- One row per uploaded file. The file itself lives in the private 'oj-documents'
-- bucket under <organization_id>/..., so its path proves which workspace owns it.
create table public.oj_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  venture text check (venture in ('exterior','solutions','essentials')),
  name text not null check (length(btrim(name)) between 1 and 200),
  tag text not null default 'other' check (tag in ('legal','insurance','tax','contract','brand','other')),
  storage_path text not null unique check (storage_path like organization_id::text || '/%' and length(storage_path) <= 400),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  mime text not null default '' check (length(mime) <= 120),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index oj_documents_org on public.oj_documents(organization_id, created_at desc);

alter table public.oj_messages enable row level security;
alter table public.oj_leads enable row level security;
alter table public.oj_finance_entries enable row level security;
alter table public.oj_metric_entries enable row level security;
alter table public.oj_events enable row level security;
alter table public.oj_documents enable row level security;

revoke all on public.oj_messages, public.oj_leads, public.oj_finance_entries, public.oj_metric_entries, public.oj_events, public.oj_documents from anon, authenticated;
grant select, insert on public.oj_messages, public.oj_leads, public.oj_finance_entries, public.oj_metric_entries, public.oj_events, public.oj_documents to authenticated;
grant update (venture, name, contact, stage, value, source, notes) on public.oj_leads to authenticated;
grant update (venture, title, starts_at, ends_at, all_day, location, notes) on public.oj_events to authenticated;
grant delete on public.oj_leads, public.oj_finance_entries, public.oj_metric_entries, public.oj_events, public.oj_documents to authenticated;

-- Same three rules on every table: members of the workspace read; owners and
-- members add rows as themselves; owners and members change or remove rows.
do $$
declare t text; owner_col text;
begin
  foreach t in array array['oj_messages','oj_leads','oj_finance_entries','oj_metric_entries','oj_events','oj_documents'] loop
    owner_col := case t when 'oj_messages' then 'author_id' when 'oj_documents' then 'uploaded_by' else 'created_by' end;
    execute format('create policy member_read on public.%I for select to authenticated using (oj_private.member_role(organization_id) is not null)', t);
    execute format('create policy member_add on public.%I for insert to authenticated with check (oj_private.member_role(organization_id) in (''owner'',''member'') and %I = (select auth.uid()))', t, owner_col);
    if t in ('oj_leads','oj_events') then
      execute format('create policy member_change on public.%I for update to authenticated using (oj_private.member_role(organization_id) in (''owner'',''member'')) with check (oj_private.member_role(organization_id) in (''owner'',''member''))', t);
    end if;
    if t <> 'oj_messages' then
      execute format('create policy member_remove on public.%I for delete to authenticated using (oj_private.member_role(organization_id) in (''owner'',''member''))', t);
    end if;
  end loop;
end $$;

-- A row never moves to another workspace or changes its creator.
create function oj_private.guard_row() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.organization_id <> old.organization_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Row identity is immutable';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function oj_private.guard_row() from public;
create trigger guard_lead before update on public.oj_leads for each row execute function oj_private.guard_row();
create trigger guard_event before update on public.oj_events for each row execute function oj_private.guard_row();

-- iPhone / calendar-app subscription. Each member can hold one private link per
-- workspace. Only the SHA-256 of the link's token is stored. The feed function
-- is callable without signing in (a calendar app cannot sign in), so the token
-- is the credential: 256 random bits, and it stops working the moment the
-- member is removed from the workspace.
create table oj_private.calendar_feeds (
  user_id uuid not null references auth.users(id),
  organization_id uuid not null references public.oj_organizations(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
alter table oj_private.calendar_feeds enable row level security;
revoke all on oj_private.calendar_feeds from public, anon, authenticated;

create function public.oj_set_calendar_feed(org uuid, digest text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or oj_private.member_role(org) is null then raise exception 'Workspace access required'; end if;
  if digest is null or digest !~ '^[a-f0-9]{64}$' then raise exception 'Invalid link'; end if;
  insert into oj_private.calendar_feeds(user_id, organization_id, token_hash) values (auth.uid(), org, digest)
  on conflict (user_id, organization_id) do update set token_hash = excluded.token_hash, created_at = now();
end $$;

create function public.oj_calendar_feed(token text)
returns table(id uuid, title text, starts_at timestamptz, ends_at timestamptz, all_day boolean, location text, notes text, venture text)
language sql stable security definer set search_path = '' as $$
  with feed as (
    select f.organization_id from oj_private.calendar_feeds f
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
$$;
revoke all on function public.oj_set_calendar_feed(uuid, text), public.oj_calendar_feed(text) from public, anon;
grant execute on function public.oj_set_calendar_feed(uuid, text) to authenticated;
grant execute on function public.oj_calendar_feed(text) to anon, authenticated;

-- Document files: a private bucket, readable and writable only under the folder
-- named after a workspace the caller belongs to. Skipped where Supabase Storage
-- is not present (the isolated test database).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit) values ('oj-documents', 'oj-documents', false, 26214400) on conflict (id) do nothing;
    execute $p$create policy oj_documents_read on storage.objects for select to authenticated using (bucket_id = 'oj-documents' and oj_private.member_role(((storage.foldername(name))[1])::uuid) is not null)$p$;
    execute $p$create policy oj_documents_add on storage.objects for insert to authenticated with check (bucket_id = 'oj-documents' and oj_private.member_role(((storage.foldername(name))[1])::uuid) in ('owner','member'))$p$;
    execute $p$create policy oj_documents_remove on storage.objects for delete to authenticated using (bucket_id = 'oj-documents' and oj_private.member_role(((storage.foldername(name))[1])::uuid) in ('owner','member'))$p$;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.oj_messages, public.oj_leads, public.oj_finance_entries, public.oj_metric_entries, public.oj_events, public.oj_documents;
  end if;
end $$;
