-- NOT APPLIED. Founder review and verified production backup required.
-- Adds the shared general business category to task cards only.
-- Does not modify existing task records or any other business tables.
-- Apply to the confirmed OJ EXTERIOR CARE LEADS Supabase project.
-- Review the live constraint definition before running: this intentionally replaces
-- the existing business CHECK only, retaining exterior, solutions, essentials and content.
begin;

do $$
declare constraint_name text;
begin
  if to_regclass('public.oj_cards') is null then
    raise exception 'oj_cards is not installed in this database';
  end if;
  for constraint_name in
    select conname from pg_constraint
      where conrelid = 'public.oj_cards'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%business%'
  loop
    execute format('alter table public.oj_cards drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.oj_cards
  add constraint oj_cards_business_check
  check (business in ('general', 'exterior', 'solutions', 'essentials', 'content'));

commit;
