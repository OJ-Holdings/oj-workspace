import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
const script = () => readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-email-cap-1500.sql', import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');`);
  for (const f of ['workspace.sql', 'outreach-pipeline.sql', 'solutions-email-engine.sql']) await db.exec(await readFile(new URL(`../supabase/schemas/${f}`, import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');
    insert into public.oj_email_engine_settings(organization_id, enabled, daily_cap_max) values ('${org}', true, 25);`);
  return db;
}
const as = async (db: PGlite, uid: string) => { await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`); };
const cap = async (db: PGlite) => { await db.exec('reset role'); return (await db.query<{ c: number }>('select daily_cap_max as c from oj_email_engine_settings')).rows[0].c; };
const set = (n: number, who = org) => `select public.oj_set_email_engine('${who}', true, ${n}, null)`;

test('before the script the database refuses 1500; after it, 1500 works, the row is 1500, and 1501 is still refused', async () => {
  const db = await setup();
  await as(db, owner);
  await assert.rejects(() => db.query(set(1500)), /between 1 and 40/);
  await db.exec('reset role');
  await assert.rejects(() => db.exec(`update oj_email_engine_settings set daily_cap_max = 1500`), /check/);

  await db.exec(await script());
  assert.equal(await cap(db), 1500, 'the existing settings row is set to 1500');
  await as(db, owner);
  await db.query(set(30));
  assert.equal(await cap(db), 30);
  await as(db, owner);
  assert.deepEqual((await db.query<{ r: { daily_cap_max: number } }>(`select public.oj_set_email_engine('${org}', true, 1500, 'dentist') as r`)).rows[0].r.daily_cap_max, 1500);
  await assert.rejects(() => db.query(set(1501)), /between 1 and 1500/);
  await assert.rejects(() => db.query(set(0)), /between 1 and 1500/);
  await db.exec('reset role');
  await assert.rejects(() => db.exec(`update oj_email_engine_settings set daily_cap_max = 1501`), /check/);
});

test('only a member of the workspace can change the cap', async () => {
  const db = await setup();
  await db.exec(await script());
  await as(db, viewer);
  await assert.rejects(() => db.query(set(1500)), /member access/);
  await as(db, stranger);
  await assert.rejects(() => db.query(set(1500)), /member access/);
  await assert.rejects(() => db.query(set(50, other)).then(() => db.query(set(1500))), /member access/);
});

test('the script can be run again without harm', async () => {
  const db = await setup();
  await db.exec(await script());
  await db.exec(await script());
  assert.equal(await cap(db), 1500);
  await as(db, owner);
  await assert.rejects(() => db.query(set(1501)), /between 1 and 1500/);
});
