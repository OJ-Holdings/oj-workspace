import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('presence and explicit work enforce identity, membership, task boundaries and stale updates', async t => {
  const db = new PGlite();
  const orgA = '00000000-0000-4000-8000-000000000001', orgB = '00000000-0000-4000-8000-000000000002';
  const oscar = '00000000-0000-4000-8000-000000000011', jacob = '00000000-0000-4000-8000-000000000012', viewer = '00000000-0000-4000-8000-000000000013';
  const cardA = '00000000-0000-4000-8000-000000000021', cardB = '00000000-0000-4000-8000-000000000022';
  const tab = '00000000-0000-4000-8000-000000000031';
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${oscar}'),('${jacob}'),('${viewer}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/presence.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${orgA}','OJ'),('${orgB}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${orgA}','${oscar}','owner','Oscar'),('${orgA}','${viewer}','viewer','Viewer'),('${orgB}','${jacob}','member','Jacob');`);
  const as = async (user: string, role = 'authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${user}'; set role ${role};`);
  await as(oscar); await db.exec(`insert into oj_cards(id,organization_id,title,business) values ('${cardA}','${orgA}','Quotes','exterior');`);
  await as(jacob); await db.exec(`insert into oj_cards(id,organization_id,title,business) values ('${cardB}','${orgB}','Other task','solutions');`);
  const heartbeat = (org = orgA, user = oscar) => db.exec(`insert into oj_presence_sessions(organization_id,user_id,session_id,state,seen_at) values ('${org}','${user}','${tab}','online','2099-01-01') on conflict(organization_id,user_id,session_id) do update set state=excluded.state,seen_at=excluded.seen_at;`);
  await t.test('own heartbeat uses database time even with a forged future timestamp', async () => {
    await as(oscar); await heartbeat();
    const row = (await db.query<{ seen_at: string }>('select seen_at from oj_presence_sessions')).rows[0];
    assert.ok(Math.abs(Date.parse(row.seen_at) - Date.now()) < 10_000);
    await heartbeat();
    assert.equal((await db.query('select * from oj_presence_sessions')).rows.length, 1);
  });
  await t.test('another user cannot be impersonated, updated or removed', async () => {
    await as(viewer);
    await assert.rejects(() => heartbeat(orgA, oscar));
    assert.equal((await db.query(`update oj_presence_sessions set state='offline' where user_id='${oscar}' returning user_id`)).rows.length, 0);
    assert.equal((await db.query(`delete from oj_presence_sessions where user_id='${oscar}' returning user_id`)).rows.length, 0);
    await heartbeat(orgA, viewer);
  });
  await t.test('cross-organization and anonymous reads/writes are denied', async () => {
    await as(jacob);
    assert.equal((await db.query('select * from oj_presence_sessions')).rows.length, 0);
    await assert.rejects(() => heartbeat(orgA, jacob));
    await as('', 'anon'); await assert.rejects(() => db.query('select * from oj_presence_sessions'));
    await assert.rejects(() => db.query('select * from oj_current_work'));
  });
  await t.test('explicit work only links a task in the same organization', async () => {
    await as(oscar);
    await assert.rejects(() => db.exec(`insert into oj_current_work(organization_id,note,card_id) values ('${orgA}','Forged','${cardB}')`));
    await db.exec(`insert into oj_current_work(organization_id,note,card_id) values ('${orgA}','Quotes','${cardA}')`);
    await assert.rejects(() => db.exec(`update oj_current_work set user_id='${viewer}'`));
  });
  await t.test('two tabs cannot silently overwrite a newer explicit status', async () => {
    await as(oscar);
    await db.exec(`update oj_current_work set note='Calls',revision=0 where revision=0`);
    assert.equal((await db.query(`update oj_current_work set note='Stale',revision=0 where revision=0 returning user_id`)).rows.length, 0);
    await assert.rejects(() => db.exec(`update oj_current_work set note='Stale',revision=0`));
    const row = (await db.query<{ note: string; revision: number }>('select note,revision from oj_current_work')).rows[0];
    assert.deepEqual(row, { note: 'Calls', revision: 1 });
  });
  await t.test('viewers may share own availability and status but cannot alter another status', async () => {
    await as(viewer);
    await db.exec(`insert into oj_current_work(organization_id,note) values ('${orgA}','Reviewing task notes')`);
    assert.equal((await db.query(`update oj_current_work set note='Forged',revision=1 where user_id='${oscar}' returning user_id`)).rows.length, 0);
  });
  await t.test('membership removal clears their presence and rejects the same identity immediately', async () => {
    await db.exec(`reset role; delete from oj_memberships where user_id='${viewer}';`);
    await as(viewer);
    assert.equal((await db.query('select * from oj_presence_sessions')).rows.length, 0);
    assert.equal((await db.query('select * from oj_current_work')).rows.length, 0);
    await assert.rejects(() => heartbeat(orgA, viewer));
    await as(oscar);
    assert.equal((await db.query(`select * from oj_presence_sessions where user_id='${viewer}'`)).rows.length, 0);
  });
  await db.close();
});
