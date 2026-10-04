-- OJ Workspace: hourly time slots for Exterior Care bookings.
--
-- The original Exterior Care app only allowed three time blocks on a booking
-- ('9-12', '12-3', '4-6'), enforced by the check bookings_time_block_check.
-- The workspace now books any start time and any length ('10-11', '4:30-9',
-- '8:15-9:45'), in the same 12-hour style: hours 1 to 7 are PM, 8 to 11 are AM.
--
-- This replaces that check with one that accepts 'H-H', 'H:MM-H' and so on, hours 1 to 12.
-- The three old blocks match it, so every existing booking stays valid. The
-- workspace itself only offers 8 AM to 8 PM, up to six hours (src/lib/exterior-ops.ts).
begin;
alter table public.bookings drop constraint if exists bookings_time_block_check;
alter table public.bookings drop constraint if exists bookings_time_block_format;
alter table public.bookings add constraint bookings_time_block_format
  check (time_block ~ '^(1[0-2]|[1-9])(:[0-5][0-9])?-(1[0-2]|[1-9])(:[0-5][0-9])?$');
commit;
