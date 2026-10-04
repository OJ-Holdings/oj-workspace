-- ============================================================================
-- OJ Workspace: any-time bookings (time blocks with minutes). APPLIED 2026-10-04
-- to project "OJ EXTERIOR CARE LEADS" as migration exterior_any_time_bookings, with Oscar's OK.
--
-- What it does: lets a booking's time_block be any start time and length
-- ('10-11', '4:30-9', '8:15-9:45'), not only the three original blocks.
-- It replaces the check "bookings_time_block_check" with a looser one. The three
-- old blocks ('9-12', '12-3', '4-6') still pass, so no existing booking changes.
--
-- To undo (only if no booking uses an hourly block):
--   alter table public.bookings drop constraint bookings_time_block_format;
--   alter table public.bookings add constraint bookings_time_block_check
--     check (time_block in ('9-12','12-3','4-6'));
-- ============================================================================
begin;
alter table public.bookings drop constraint if exists bookings_time_block_check;
alter table public.bookings drop constraint if exists bookings_time_block_format;
alter table public.bookings add constraint bookings_time_block_format
  check (time_block ~ '^(1[0-2]|[1-9])(:[0-5][0-9])?-(1[0-2]|[1-9])(:[0-5][0-9])?$');
commit;
