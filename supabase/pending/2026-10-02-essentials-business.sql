-- PENDING: not applied to the live project yet. Needs a founder's OK first.
--
-- Lets tasks belong to OJ Essentials. Until this runs on the live database,
-- saving a task with Business = OJ Essentials is rejected by the database
-- (the app shows "Could not save the card").
--
-- Additive and reversible: it only widens the allowed values.
-- To undo: re-create the constraint with ('exterior','solutions') after moving
-- any 'essentials' cards to another business.
alter table public.oj_cards drop constraint if exists oj_cards_business_check;
alter table public.oj_cards add constraint oj_cards_business_check
  check (business in ('exterior', 'solutions', 'essentials'));
