import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createLockedLegacyTables } from './exterior-read.test';

// Any file a founder is asked to paste into the live database must run cleanly,
// start to finish, on top of what is already live: the workspace, collaboration
// and dashboard schemas, one workspace, the locked Exterior Care tables and the
// read access already applied to them.
test('pending database updates apply cleanly on top of the live schema', async () => {
  const dir = new URL('../supabase/pending/', import.meta.url);
  const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith('.sql'));
  for (const file of files) {
    const db = new PGlite();
    await db.exec(`create role authenticated; create role anon;
      create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon;`);
    for (const live of ['workspace.sql', 'collaboration.sql', 'dashboard.sql']) await db.exec(await readFile(new URL(`../supabase/schemas/${live}`, import.meta.url), 'utf8'));
    await createLockedLegacyTables(db);
    await db.exec(`insert into public.oj_organizations(id,name) values ('00000000-0000-4000-8000-000000000001','OJ')`);
    await db.exec(await readFile(new URL('../supabase/schemas/exterior-read.sql', import.meta.url), 'utf8'));
    const anonGrants = async () => (await db.query(`select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' order by 1, 2`)).rows;
    const before = await anonGrants();
    await db.exec(await readFile(new URL(file, dir), 'utf8')).catch(e => assert.fail(`${file} did not apply: ${e.message}`));
    const unprotected = (await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname in ('public','oj_private') and not rowsecurity`)).rows;
    assert.deepEqual(unprotected, [], `${file} leaves no table without row-level security`);
    assert.deepEqual(await anonGrants(), before, `${file} gives signed-out visitors no new table access`);
    await db.close();
  }
});
