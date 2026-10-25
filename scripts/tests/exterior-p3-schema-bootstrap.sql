-- SYNTHETIC ROLE HARNESS ONLY: not a production database or Supabase Auth.
-- Auth identity uses a session-local fake JWT claim, never user_metadata.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid
 language sql stable set search_path='' as $$
 select pg_catalog.nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
 $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
