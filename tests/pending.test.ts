import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Any file a founder is asked to paste into the live database must run cleanly,
// start to finish, on top of the schema that is already live.
test('pending database updates apply cleanly on top of the live schema', async () => {
  const dir = new URL('../supabase/pending/', import.meta.url);
  const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith('.sql'));
  for (const file of files) {
    const db = new PGlite();
    await db.exec(`create role authenticated; create role anon;
      create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon;`);
    for (const live of ['workspace.sql', 'collaboration.sql']) await db.exec(await readFile(new URL(`../supabase/schemas/${live}`, import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
    const tables = (await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname='public' and tablename like 'oj_%'`)).rows.map(r => r.tablename);
    for (const expected of ['oj_messages', 'oj_leads', 'oj_finance_entries', 'oj_metric_entries', 'oj_events', 'oj_documents']) assert.ok(tables.includes(expected), `${file} creates ${expected}`);
    const unprotected = (await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname='public' and tablename like 'oj_%' and not rowsecurity`)).rows;
    assert.deepEqual(unprotected, [], `${file} leaves no table without row-level security`);
    // A signed-in member can now file a task under Essentials (the activity trigger needs a real actor).
    await db.exec(`insert into auth.users(id) values ('00000000-0000-4000-8000-000000000011'); insert into public.oj_organizations(id,name) values ('00000000-0000-4000-8000-000000000001','OJ');
      insert into public.oj_memberships(organization_id,user_id,role,display_name) values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','member','Oscar');
      grant execute on function auth.uid() to authenticated; set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000011'; set role authenticated;
      insert into public.oj_cards(organization_id,title,business) values ('00000000-0000-4000-8000-000000000001','Essentials task','essentials')`).catch(e => assert.fail(`${file}: essentials tasks should be allowed (${e.message})`));
    await db.close();
  }
});
