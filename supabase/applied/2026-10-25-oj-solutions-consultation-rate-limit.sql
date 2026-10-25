-- Atomic public-form rate budget; callable only by the Edge Function's service role.
-- Fingerprints are server-side salted SHA-256 IP hashes, never plaintext addresses.
create table if not exists oj_private.oj_solutions_consultation_limits (
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 5),
  primary key (fingerprint, window_start)
);
create index if not exists oj_solutions_consultation_limits_window
  on oj_private.oj_solutions_consultation_limits(window_start);
alter table oj_private.oj_solutions_consultation_limits enable row level security;
revoke all on oj_private.oj_solutions_consultation_limits from public, anon, authenticated;
create or replace function public.oj_solutions_consultation_check_rate(p_fingerprint text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare 
  current_window timestamptz := to_timestamp(floor(extract(epoch from now()) / 900) * 900);
  next_count integer;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  insert into oj_private.oj_solutions_consultation_limits(fingerprint,window_start,attempts)
    values (p_fingerprint,current_window,1)
    on conflict (fingerprint,window_start)
    do update set attempts=oj_private.oj_solutions_consultation_limits.attempts+1
      where oj_private.oj_solutions_consultation_limits.attempts < 5
    returning attempts into next_count;
  -- Occasionally prune stale counters to avoid storing fingerprints indefinitely.
  if random() < 0.02 then
    delete from oj_private.oj_solutions_consultation_limits where window_start < now() - interval '2 days';
  end if;
  return next_count is not null;
end $$;
revoke all on function public.oj_solutions_consultation_check_rate(text) from PUBLIC, anon, authenticated;
grant execute on function public.oj_solutions_consultation_check_rate(text) to service_role;
