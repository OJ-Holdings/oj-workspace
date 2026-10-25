-- Scheduling repair: the existing valid H:MM-H:MM format requires 11 chars.
-- Widen only; retain every existing booking, policy, grant and format check.
begin;
set local lock_timeout = '5s';
alter table public.bookings alter column time_block type character varying(11);
commit;
