-- OJ Workspace: remove test and spam rows. NOT APPLIED. Run only with Oscar's OK.
-- Run in the Supabase SQL editor for the OJ EXTERIOR CARE LEADS project.
--
-- What it deletes (8 rows, chosen by exact id after reading them on 2026-10-27):
--   7 website quote requests that are tests or spam (names such as "test 2", "Test", "Alienware Area-51 R4",
--      three "Jacob Denure" test submissions, and one abusive submission).
--   1 abusive message in the founders' notes.
-- It deletes nothing else. If any id is missing or a count is off, it raises an error and changes nothing.
-- Not touched on purpose: "Sangeeta LNU" (empty but possibly a real request), the synthetic
-- "SYSTEM SAVE VERIFICATION" commercial project (has child rows; remove through the app later).

begin;

-- Preview: these are the rows that will go.
select 'quote_request' as kind, id, left(name, 24) as name, created_at::date as day
from public.quote_requests
where id in (
  '48da01bb-d227-4b7f-b269-06fdf5f52e25', 'ba2ead09-75b1-4302-9017-7aa5c84b3d2f', '5aa6340a-91d7-4c4c-81fd-99ee21a15de6',
  '1234dc68-794b-4f48-a05c-7427e47c7934', '3ed24650-590c-4126-a14f-3ab24f61ff37', '35056300-635e-424e-ab06-8bda55d2f7d0',
  '90db22b6-41de-4254-af84-ef07fad899f0')
union all
select 'message', id, left(body, 12), created_at::date
from public.oj_messages
where id = '9a78351a-9366-47d6-b6b4-905b88eb544b';

do $$
declare n_q int; n_m int;
begin
  delete from public.quote_requests where id in (
    '48da01bb-d227-4b7f-b269-06fdf5f52e25', 'ba2ead09-75b1-4302-9017-7aa5c84b3d2f', '5aa6340a-91d7-4c4c-81fd-99ee21a15de6',
    '1234dc68-794b-4f48-a05c-7427e47c7934', '3ed24650-590c-4126-a14f-3ab24f61ff37', '35056300-635e-424e-ab06-8bda55d2f7d0',
    '90db22b6-41de-4254-af84-ef07fad899f0');
  get diagnostics n_q = row_count;
  delete from public.oj_messages where id = '9a78351a-9366-47d6-b6b4-905b88eb544b';
  get diagnostics n_m = row_count;
  if n_q <> 7 or n_m <> 1 then
    raise exception 'Expected to delete 7 quote requests and 1 message, deleted % and %. Nothing changed.', n_q, n_m;
  end if;
  raise notice 'Deleted % quote requests and % message.', n_q, n_m;
end $$;

commit;
