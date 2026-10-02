import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const legacyTables = ['leads', 'conversations', 'bookings', 'doorknocking_sessions', 'activity_log'];

/** The Exterior Care tables as they are on the live project today: row-level security on, no access for anyone but the backend. */
export async function createLockedLegacyTables(db: PGlite) {
  await db.exec(`create role service_role bypassrls; grant usage on schema public to service_role;`);
  for (const table of [...legacyTables, 'settings']) {
    await db.exec(`create table public.${table}(id uuid primary key default gen_random_uuid(), payload text);
      alter table public.${table} enable row level security;
      revoke all on public.${table} from public, anon, authenticated;
      grant all on public.${table} to service_role;
      insert into public.${table}(payload) values ('Customer record');`);
  }
}

test('Exterior Care records are readable by workspace owners and members only, and writable by no one in the workspace', async t => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001';
  const owner = '00000000-0000-4000-8000-000000000011';
  const member = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  const stranger = '00000000-0000-4000-8000-000000000014';
  await db.exec(`create role authenticated; create role anon;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${member}'),('${viewer}'),('${stranger}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await createLockedLegacyTables(db);
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${org}','${owner}','owner','Oscar'),('${org}','${member}','member','Jacob'),('${org}','${viewer}','viewer','Viewer');`);
  await db.exec(await readFile(new URL('../supabase/schemas/exterior-read.sql', import.meta.url), 'utf8'));
  const as = async (id: string, role = 'authenticated') => { await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role ${role};`); };

  await t.test('owner and member can read every Exterior Care table', async () => {
    for (const who of [owner, member]) {
      await as(who);
      for (const table of legacyTables) assert.equal((await db.query(`select id from public.${table}`)).rows.length, 1, table);
    }
  });
  await t.test('viewer, a signed-in stranger and signed-out visitors read nothing', async () => {
    for (const who of [viewer, stranger]) {
      await as(who);
      for (const table of legacyTables) assert.equal((await db.query(`select id from public.${table}`)).rows.length, 0, table);
    }
    await as('', 'anon');
    for (const table of legacyTables) await assert.rejects(() => db.query(`select id from public.${table}`), table);
  });
  await t.test('nobody in the workspace can add, change, remove or empty a legacy table', async () => {
    await as(owner);
    for (const table of legacyTables) {
      await assert.rejects(() => db.exec(`insert into public.${table}(payload) values ('Forged')`), table);
      await assert.rejects(() => db.exec(`update public.${table} set payload = 'Changed'`), table);
      await assert.rejects(() => db.exec(`delete from public.${table}`), table);
      await assert.rejects(() => db.exec(`truncate public.${table}`), table);
    }
  });
  await t.test('the legacy settings table stays closed and the ownership table cannot be edited', async () => {
    await as(owner);
    await assert.rejects(() => db.query('select * from public.settings'));
    await assert.rejects(() => db.exec(`insert into oj_private.legacy_owner values ('${org}')`));
    await assert.rejects(() => db.query('select * from oj_private.legacy_owner'));
  });
  await t.test('the backend keeps full access', async () => {
    await db.exec('reset role; set role service_role;');
    for (const table of legacyTables) {
      await db.exec(`insert into public.${table}(payload) values ('Backend write')`);
      assert.equal((await db.query(`select id from public.${table}`)).rows.length, 2, table);
    }
  });
  await t.test('access ends when membership ends', async () => {
    await db.exec(`reset role; delete from public.oj_memberships where user_id = '${member}'`);
    await as(member);
    assert.equal((await db.query('select id from public.leads')).rows.length, 0);
  });
  await db.close();
});
