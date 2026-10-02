-- Desired restrictions for existing Exterior Care tables. Apply only after confirming
-- the legacy backend uses its server-only service role. Never send that key to this app.
-- Preserve anonymous website quote submission while blocking public reads and edits.
create table oj_private.legacy_quote_readers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table oj_private.legacy_quote_readers enable row level security;
revoke all on oj_private.legacy_quote_readers from public,anon,authenticated;

-- Freeze the pre-existing quote-reader population. New signups receive no quote access.
insert into oj_private.legacy_quote_readers(user_id) select id from auth.users;

create function oj_private.can_read_legacy_quotes() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from oj_private.legacy_quote_readers where user_id=auth.uid()
  )
$$;
revoke all on function oj_private.can_read_legacy_quotes() from public,anon;
grant execute on function oj_private.can_read_legacy_quotes() to authenticated;

alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.bookings enable row level security;
alter table public.settings enable row level security;
alter table public.doorknocking_sessions enable row level security;
alter table public.activity_log enable row level security;
alter table public.quote_requests enable row level security;

drop policy "Enable all access to leads" on public.leads;
drop policy "Enable all access to conversations" on public.conversations;
drop policy "Enable all access to bookings" on public.bookings;
drop policy "Enable all access to settings" on public.settings;
revoke all on public.leads,public.conversations,public.bookings,public.settings,
  public.doorknocking_sessions,public.activity_log from public,anon,authenticated;

revoke all on public.quote_requests from public,anon,authenticated;
grant insert on public.quote_requests to anon;
grant select on public.quote_requests to authenticated;
alter policy "Allow authenticated read" on public.quote_requests
  to authenticated using ((select oj_private.can_read_legacy_quotes()));

-- Existing backend privileges remain unchanged; service_role bypasses RLS.
-- The reviewed trigger uses only CURRENT_TIMESTAMP and NEW.updated_at.
alter function public.update_updated_at_column() set search_path=pg_catalog;
