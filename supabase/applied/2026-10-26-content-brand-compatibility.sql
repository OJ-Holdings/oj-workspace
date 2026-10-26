-- Applied by the owner-authorized release on 2026-10-26.
-- Supabase migration 20261026144621: oj_content_brand_compatibility.
-- Retained for synthetic recovery tests; do not reapply to extended constraints.
-- Extend only the eight independently inspected brand checks. No row changes,
-- no RLS/grant changes and no feature flag activation. Unknown schemas fail closed.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$
declare v record; actual text; expected text;
begin
  for v in select * from (values
    ('oj_cards','business','oj_cards_business_check',false),
    ('oj_documents','venture','oj_documents_venture_check',false),
    ('oj_events','venture','oj_events_venture_check',false),
    ('oj_finance_entries','venture','oj_finance_entries_venture_check',false),
    ('oj_leads','venture','oj_leads_venture_check',false),
    ('oj_messages','venture','oj_messages_venture_check',false),
    ('oj_metric_entries','venture','oj_metric_entries_venture_check',false),
    ('oj_work_sessions','business','oj_work_sessions_business_check',true)
  ) x(tbl,col,constraint_name,has_general) loop
    expected:=case when v.has_general then '''general''::text, ' else '' end ||
      '''exterior''::text, ''solutions''::text, ''essentials''::text';
    select pg_catalog.pg_get_constraintdef(c.oid) into actual
      from pg_catalog.pg_constraint c where c.conrelid=pg_catalog.to_regclass('public.'||v.tbl)
        and c.conname=v.constraint_name and c.contype='c';
    if actual is distinct from format('CHECK ((%I = ANY (ARRAY[%s])))',v.col,expected) then
      raise exception 'Content brand prerequisite changed; review the current schema before activation';
    end if;
    execute format('alter table public.%I drop constraint %I, add constraint %I check (%I = any(array[%s, ''content''::text]))',
      v.tbl,v.constraint_name,v.constraint_name,v.col,expected);
  end loop;
end $$;
commit;
