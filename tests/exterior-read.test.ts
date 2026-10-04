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
  // Bookings on the live project carry a date and one of three time blocks, enforced by a check; later updates alter that rule.
  await db.exec(`alter table public.bookings add column date date, add column time_block varchar check (time_block in ('9-12','12-3','4-6'));`);
  // Settings is a key/value table; quote requests come from the public website form, so signed-out visitors may add (never read) them.
  await db.exec(`delete from public.settings;
    alter table public.settings add column key text unique, add column value text, add column updated_at timestamptz;
    insert into public.settings(key, value) values ('monthlyRevenueGoal', '20000'), ('upgrades_completed', '{"eq_safety":true}'), ('ownerPhone', '+15550100');
    create table public.quote_requests(id uuid primary key default gen_random_uuid(), payload text);
    alter table public.quote_requests enable row level security;
    revoke all on public.quote_requests from public, anon, authenticated;
    grant all on public.quote_requests to service_role;
    grant insert on public.quote_requests to anon;
    create policy "Allow anon insert" on public.quote_requests for insert to anon with check (true);
    insert into public.quote_requests(payload) values ('Website request');`);
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
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/schemas/exterior-extras.sql', import.meta.url), 'utf8'));
  const settings = async () => (await db.query<{ s: Record<string, string> | null }>('select public.oj_exterior_settings() as s')).rows[0].s;

  await t.test('quote requests: owners and members read, viewers and strangers do not, visitors can still only add', async () => {
    await as(member);
    assert.equal((await db.query('select id from public.quote_requests')).rows.length, 1);
    await assert.rejects(() => db.exec(`delete from public.quote_requests`));
    for (const who of [viewer, stranger]) { await as(who); assert.equal((await db.query('select id from public.quote_requests')).rows.length, 0); }
    await as('', 'anon');
    await assert.rejects(() => db.query('select id from public.quote_requests'));
    await db.exec(`insert into public.quote_requests(payload) values ('New request')`);
  });
  await t.test('only the goal and the upgrades list leave the settings table, and only for owners and members', async () => {
    await as(member);
    assert.deepEqual(await settings(), { monthlyRevenueGoal: '20000', upgrades_completed: '{"eq_safety":true}' });
    await assert.rejects(() => db.query('select * from public.settings'));
    for (const who of [viewer, stranger]) { await as(who); assert.equal(await settings(), null); }
    await as('', 'anon');
    await assert.rejects(() => settings());
  });
  await t.test('members can save the upgrades list and nothing else; bad shapes and other roles are refused', async () => {
    await as(member);
    await db.query(`select public.oj_set_exterior_upgrades('{"eq_safety":true,"biz_llc":true}'::jsonb)`);
    assert.deepEqual(JSON.parse((await settings())!.upgrades_completed), { eq_safety: true, biz_llc: true });
    for (const bad of [`'[]'`, `'{"a":false}'`, `'{"a":"true"}'`, `'{"Bad Key":true}'`, `'"text"'`, 'null']) await assert.rejects(() => db.query(`select public.oj_set_exterior_upgrades(${bad}::jsonb)`), bad);
    for (const who of [viewer, stranger]) { await as(who); await assert.rejects(() => db.query(`select public.oj_set_exterior_upgrades('{}'::jsonb)`)); }
    await as('', 'anon');
    await assert.rejects(() => db.query(`select public.oj_set_exterior_upgrades('{}'::jsonb)`));
    await db.exec('reset role');
    const rows = (await db.query<{ key: string; value: string }>('select key, value from public.settings order by key')).rows;
    assert.deepEqual(rows.map(r => r.key), ['monthlyRevenueGoal', 'ownerPhone', 'upgrades_completed']);
    assert.equal(rows[1].value, '+15550100');
    await db.exec(`delete from public.settings where key = 'upgrades_completed'`);
    await as(owner);
    await db.query(`select public.oj_set_exterior_upgrades('{"svc_pw":true}'::jsonb)`);
    assert.deepEqual(JSON.parse((await settings())!.upgrades_completed), { svc_pw: true });
  });
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/schemas/exterior-write.sql', import.meta.url), 'utf8'));

  await t.test('members can add, change and remove leads, bookings and door-knocking sessions', async () => {
    for (const who of [owner, member]) {
      await as(who);
      for (const table of ['leads', 'bookings', 'doorknocking_sessions']) {
        const { rows } = await db.query<{ id: string }>(`insert into public.${table}(payload) values ('From the workspace') returning id`);
        assert.equal((await db.query(`update public.${table} set payload = 'Edited' where id = '${rows[0].id}' returning id`)).rows.length, 1, table);
        assert.equal((await db.query(`delete from public.${table} where id = '${rows[0].id}' returning id`)).rows.length, 1, table);
      }
    }
  });
  await t.test('texts can be moved between leads but not written or removed; history can be added to but not rewritten', async () => {
    await as(member);
    assert.ok((await db.query(`update public.conversations set payload = 'Moved' returning id`)).rows.length >= 1);
    await assert.rejects(() => db.exec(`insert into public.conversations(payload) values ('Forged text')`));
    await assert.rejects(() => db.exec(`delete from public.conversations`));
    await db.exec(`insert into public.activity_log(payload) values ('Marked a lead as booked')`);
    await assert.rejects(() => db.exec(`update public.activity_log set payload = 'Rewritten'`));
    await assert.rejects(() => db.exec(`delete from public.activity_log`));
    await assert.rejects(() => db.exec(`truncate public.leads`));
  });
  await t.test('viewers, strangers and signed-out visitors still cannot write anything', async () => {
    for (const who of [viewer, stranger]) {
      await as(who);
      for (const table of ['leads', 'bookings', 'doorknocking_sessions', 'activity_log']) await assert.rejects(() => db.exec(`insert into public.${table}(payload) values ('Forged')`), table);
      for (const table of ['leads', 'bookings', 'doorknocking_sessions', 'conversations']) assert.equal((await db.query(`update public.${table} set payload = 'Changed' returning id`)).rows.length, 0, table);
      for (const table of ['leads', 'bookings', 'doorknocking_sessions']) assert.equal((await db.query(`delete from public.${table} returning id`)).rows.length, 0, table);
    }
    await as('', 'anon');
    for (const table of legacyTables) await assert.rejects(() => db.exec(`insert into public.${table}(payload) values ('Forged')`), table);
  });
  await t.test('named settings can be read and saved by members; anything else is refused', async () => {
    await as(member);
    await db.query(`select public.oj_set_exterior_settings('{"monthlyRevenueGoal":"25000","aiStyle":"casual","ownerPhone":"+15550199"}'::jsonb)`);
    const s = await settings();
    assert.equal(s!.monthlyRevenueGoal, '25000'); assert.equal(s!.aiStyle, 'casual'); assert.equal(s!.ownerPhone, '+15550199');
    for (const bad of [`'{"upgrades_completed":"{}"}'`, `'{"secretKey":"x"}'`, `'{"aiStyle":5}'`, `'{"aiStyle":null}'`, `'[]'`, 'null', `'{"address":"${'x'.repeat(2001)}"}'`]) await assert.rejects(() => db.query(`select public.oj_set_exterior_settings(${bad}::jsonb)`), bad.slice(0, 40));
    await assert.rejects(() => db.query('select * from public.settings'));
    await assert.rejects(() => db.exec(`update public.settings set value = 'x'`));
    for (const who of [viewer, stranger]) { await as(who); await assert.rejects(() => db.query(`select public.oj_set_exterior_settings('{"aiStyle":"x"}'::jsonb)`)); assert.equal(await settings(), null); }
    await as('', 'anon');
    await assert.rejects(() => db.query(`select public.oj_set_exterior_settings('{"aiStyle":"x"}'::jsonb)`));
  });
  await t.test('access ends when membership ends', async () => {
    await db.exec(`reset role; delete from public.oj_memberships where user_id = '${member}'`);
    await as(member);
    assert.equal((await db.query('select id from public.leads')).rows.length, 0);
  });
  await db.close();
});
