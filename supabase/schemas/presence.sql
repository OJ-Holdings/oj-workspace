-- Desired additive schema, after workspace.sql. Review/apply to OJ separately.
-- One row per browser session; online state expires after 90 seconds in readers.
create table public.oj_presence_sessions (
  organization_id uuid not null,
  user_id uuid not null default auth.uid(),
  session_id uuid not null,
  state text not null check (state in ('online','away','offline')),
  seen_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,user_id,session_id),
  foreign key (organization_id,user_id) references public.oj_memberships(organization_id,user_id) on delete cascade
);
create index oj_presence_recent on public.oj_presence_sessions(organization_id,seen_at desc);
create table public.oj_current_work (
  organization_id uuid not null,
  user_id uuid not null default auth.uid(),
  note text not null default '' check (length(note) <= 160),
  card_id uuid,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (organization_id,user_id),
  foreign key (organization_id,user_id) references public.oj_memberships(organization_id,user_id) on delete cascade,
  foreign key (organization_id,card_id) references public.oj_cards(organization_id,id)
);
create index oj_current_work_card on public.oj_current_work(organization_id,card_id);
alter table public.oj_presence_sessions enable row level security;
alter table public.oj_current_work enable row level security;
revoke all on public.oj_presence_sessions,public.oj_current_work from public,anon,authenticated;
grant select,insert,update,delete on public.oj_presence_sessions to authenticated;
grant select,insert on public.oj_current_work to authenticated;
grant update (note,card_id,revision) on public.oj_current_work to authenticated;
create policy presence_read on public.oj_presence_sessions for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy presence_create on public.oj_presence_sessions for insert to authenticated with check (user_id=(select auth.uid()) and oj_private.member_role(organization_id) is not null);
create policy presence_update on public.oj_presence_sessions for update to authenticated using (user_id=(select auth.uid()) and oj_private.member_role(organization_id) is not null) with check (user_id=(select auth.uid()) and oj_private.member_role(organization_id) is not null);
create policy presence_delete on public.oj_presence_sessions for delete to authenticated using (user_id=(select auth.uid()) and oj_private.member_role(organization_id) is not null);
create policy work_read on public.oj_current_work for select to authenticated using (oj_private.member_role(organization_id) is not null);
create policy work_create on public.oj_current_work for insert to authenticated with check (user_id=(select auth.uid()) and oj_private.member_role(organization_id) is not null and revision=0);
create policy work_update on public.oj_current_work for update to authenticated using (user_id=(select auth.uid()) and oj_private.member_role(organization_id) is not null) with check (user_id=(select auth.uid()) and oj_private.member_role(organization_id) is not null);
create function oj_private.guard_presence() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.organization_id<>old.organization_id or new.user_id<>old.user_id or new.session_id<>old.session_id) then raise exception 'Presence identity is immutable'; end if;
  new.seen_at := clock_timestamp();
  return new;
end $$;
revoke all on function oj_private.guard_presence() from public;
create trigger guard_presence before insert or update on public.oj_presence_sessions for each row execute function oj_private.guard_presence();
create function oj_private.guard_current_work() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.organization_id<>old.organization_id or new.user_id<>old.user_id then raise exception 'Work identity is immutable'; end if;
    if new.revision<>old.revision then raise exception 'Stale work status'; end if;
    new.revision:=old.revision+1;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
revoke all on function oj_private.guard_current_work() from public;
create trigger guard_current_work before insert or update on public.oj_current_work for each row execute function oj_private.guard_current_work();
do $$ declare item text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach item in array array['oj_presence_sessions','oj_current_work'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=item) then execute format('alter publication supabase_realtime add table public.%I',item); end if;
    end loop;
  end if;
end $$;
