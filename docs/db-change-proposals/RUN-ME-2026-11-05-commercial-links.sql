-- OJ OS: tie proposals, invoices and documents to a commercial company (Customers > Commercial).
-- Additive only: one nullable column on each table, an index, and one linking function. No existing row changes.
-- Run once in the Supabase SQL editor. Until it is run, company pages simply show no linked records.
begin;

alter table public.oj_proposals add column commercial_account_id uuid;
alter table public.oj_invoices add column commercial_account_id uuid;
alter table public.oj_documents add column commercial_account_id uuid;
-- Same-organization company only. A company with linked records cannot be deleted (no delete exists today anyway).
alter table public.oj_proposals add constraint oj_proposals_commercial_account
  foreign key (organization_id, commercial_account_id) references public.oj_commercial_accounts(organization_id, id) on delete restrict;
alter table public.oj_invoices add constraint oj_invoices_commercial_account
  foreign key (organization_id, commercial_account_id) references public.oj_commercial_accounts(organization_id, id) on delete restrict;
alter table public.oj_documents add constraint oj_documents_commercial_account
  foreign key (organization_id, commercial_account_id) references public.oj_commercial_accounts(organization_id, id) on delete restrict;
create index oj_proposals_commercial on public.oj_proposals(organization_id, commercial_account_id) where commercial_account_id is not null;
create index oj_invoices_commercial on public.oj_invoices(organization_id, commercial_account_id) where commercial_account_id is not null;
create index oj_documents_commercial on public.oj_documents(organization_id, commercial_account_id) where commercial_account_id is not null;

-- Reading needs nothing new: the existing read policies already cover these rows.
-- Linking goes through this one function, because members cannot update these tables directly.
-- Pass null as p_account_id to unlink. Only owners and members may link.
create function public.oj_commercial_link_record(p_organization_id uuid, p_kind text, p_record_id uuid, p_account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  if auth.uid() is null or coalesce(oj_private.member_role(p_organization_id), '') not in ('owner','member') then
    raise exception 'Company membership required' using errcode = '42501';
  end if;
  if p_kind = 'proposal' then
    -- Like the invoice guard below, the proposal guard allows this flag and still rejects changes to number, customer and amounts.
    perform set_config('oj.allow_proposal_change', '1', true);
    update public.oj_proposals set commercial_account_id = p_account_id where organization_id = p_organization_id and id = p_record_id;
    get diagnostics v_rows = row_count;
    perform set_config('oj.allow_proposal_change', '', true);
  elsif p_kind = 'invoice' then
    perform set_config('oj.allow_invoice_link', '1', true);
    update public.oj_invoices set commercial_account_id = p_account_id where organization_id = p_organization_id and id = p_record_id;
    get diagnostics v_rows = row_count;
    perform set_config('oj.allow_invoice_link', '', true);
  elsif p_kind = 'document' then
    update public.oj_documents set commercial_account_id = p_account_id where organization_id = p_organization_id and id = p_record_id;
    get diagnostics v_rows = row_count;
  else
    raise exception 'Unknown record kind' using errcode = '22023';
  end if;
  if v_rows = 0 then raise exception 'Record not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.oj_commercial_link_record(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.oj_commercial_link_record(uuid, text, uuid, uuid) to authenticated;

commit;
