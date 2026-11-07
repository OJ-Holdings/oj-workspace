-- NOT APPLIED. Founder review and verified production backup required.
-- Additive daily row-count snapshot for Spark feed. It stores counts, not sheet content.
begin;
create table if not exists public.oj_outreach_spark_snapshots (
 organization_id uuid not null references public.oj_organizations(id),
 snapshot_day date not null,
 sender text not null check (sender in ('Jacob','Oscar')),
 channel text not null check (channel in ('email','dm')),
 row_count integer not null check (row_count >= 0),
 updated_at timestamptz not null default now(),
 primary key(organization_id,snapshot_day,sender,channel)
);
create index if not exists oj_spark_latest on public.oj_outreach_spark_snapshots(organization_id,snapshot_day desc);
alter table public.oj_outreach_spark_snapshots enable row level security;
revoke all on public.oj_outreach_spark_snapshots from public,anon,authenticated;
grant select on public.oj_outreach_spark_snapshots to authenticated;
grant select,insert,update on public.oj_outreach_spark_snapshots to service_role;
create policy oj_spark_members_read on public.oj_outreach_spark_snapshots for select to authenticated
 using(oj_private.member_role(organization_id) in ('owner','member'));
commit;
