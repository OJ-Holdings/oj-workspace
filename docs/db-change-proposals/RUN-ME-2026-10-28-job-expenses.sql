-- OJ OS: itemised job expenses (materials, fuel, labor, equipment, other).
-- Additive only: one new table, nothing existing is changed. Run once in the Supabase SQL editor.
-- Until it is run, the Job sheet keeps its single "Job costs" box and nothing breaks.
begin;

create table public.oj_job_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.oj_organizations(id),
  -- The job's lead (public.leads.id). No foreign key: that table belongs to the original Exterior Care app.
  lead_id uuid not null,
  kind text not null check (kind in ('materials','fuel','labor','equipment','other')),
  amount numeric(12,2) not null check (amount >= 0 and amount < 1000000),
  note text not null default '' check (length(note) <= 300),
  spent_on date not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index oj_job_expenses_lead on public.oj_job_expenses(organization_id, lead_id);

alter table public.oj_job_expenses enable row level security;
revoke all on public.oj_job_expenses from anon, authenticated;
grant select, insert, delete on public.oj_job_expenses to authenticated;

-- Job costs are business financials, so like the customer records they stay hidden from view-only members:
-- owners and members read, add rows as themselves, and remove them.
create policy member_read on public.oj_job_expenses for select to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));
create policy member_add on public.oj_job_expenses for insert to authenticated
  with check (oj_private.member_role(organization_id) in ('owner','member') and created_by = (select auth.uid()));
create policy member_remove on public.oj_job_expenses for delete to authenticated
  using (oj_private.member_role(organization_id) in ('owner','member'));

commit;
