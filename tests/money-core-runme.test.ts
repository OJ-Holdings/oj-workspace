import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('the owner-run money core SQL applies cleanly in one go and refuses a second run', async () => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001', owner = '00000000-0000-4000-8000-000000000011';
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'); insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar');`);
  const script = await readFile(new URL('../docs/db-change-proposals/RUN-ME-money-core.sql', import.meta.url), 'utf8');
  await db.exec(script);
  await db.exec(`reset role; set request.jwt.claim.sub='${owner}'; set role authenticated; select public.oj_seed_chart('${org}');`);
  assert.ok((await db.query<{ n: number }>('select count(*)::int as n from oj_accounts')).rows[0].n >= 30);
  await db.exec('reset role');
  await assert.rejects(() => db.exec(script), /already exists/);
});
