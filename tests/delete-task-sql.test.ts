import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const oscar = '00000000-0000-4000-8000-000000000011', jacob = '00000000-0000-4000-8000-000000000012', viewer = '00000000-0000-4000-8000-000000000013', stranger = '00000000-0000-4000-8000-000000000014';
const card = '10000000-0000-4000-8000-000000000001', card2 = '10000000-0000-4000-8000-000000000002', foreign = '10000000-0000-4000-8000-000000000003';
const schema = (f: string) => readFile(new URL(`../supabase/schemas/${f}`, import.meta.url), 'utf8');
const script = () => readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-delete-task.sql', import.meta.url), 'utf8');

async function setup(withPresence = false) {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${oscar}'),('${jacob}'),('${viewer}'),('${stranger}');`);
  await db.exec(await schema('workspace.sql'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${oscar}','owner','Oscar'),('${org}','${jacob}','member','Jacob'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');
    set request.jwt.claim.sub='${oscar}';
    insert into public.oj_cards(id,organization_id,title,business,stage,created_by) values ('${card}','${org}','Mow','exterior','Done','${oscar}'),('${card2}','${org}','Keep','exterior','Backlog','${oscar}');
    insert into public.oj_comments(organization_id,card_id,author_id,body) values ('${org}','${card}','${oscar}','a note');
    set request.jwt.claim.sub='${stranger}';
    insert into public.oj_cards(id,organization_id,title,business,stage,created_by) values ('${foreign}','${other}','Theirs','exterior','Backlog','${stranger}');
    reset request.jwt.claim.sub;`);
  await db.exec(await schema('work-leaderboard.sql'));
  if (withPresence) await db.exec(`create publication supabase_realtime; ${await schema('presence.sql')}`);
  await db.exec(await script());
  return db;
}
const as = (db: PGlite, id: string) => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`);
const count = async (db: PGlite, sql: string) => { await db.exec('reset role'); return Number((await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`)).rows[0].n); };
const del = (c: string, o = org) => `select public.oj_delete_card('${o}','${c}')`;

test('a member deletes a task together with its comments and activity, and nothing else', async () => {
  const db = await setup();
  await as(db, jacob);
  await db.query(del(card));
  assert.equal(await count(db, `public.oj_cards where id='${card}'`), 0);
  assert.equal(await count(db, `public.oj_comments where card_id='${card}'`), 0);
  assert.equal(await count(db, `public.oj_activity where card_id='${card}'`), 0);
  assert.equal(await count(db, `public.oj_cards where organization_id='${org}'`), 1);
  assert.equal(await count(db, `public.oj_activity where card_id='${card2}'`), 1, 'another task keeps its activity');
});

test('viewers, strangers, signed-out callers and other workspaces cannot delete, and a missing task is a clear error', async () => {
  const db = await setup();
  await as(db, viewer); await assert.rejects(() => db.query(del(card)), /member access required/);
  await as(db, stranger); await assert.rejects(() => db.query(del(card)), /member access required/);
  await as(db, oscar); await assert.rejects(() => db.query(del(foreign)), /no longer exists/, 'a task from another workspace is out of reach');
  await db.exec(`reset role; reset request.jwt.claim.sub; set role authenticated;`); await assert.rejects(() => db.query(del(card)), /member access required/);
  await db.exec(`reset role; set role anon;`); await assert.rejects(() => db.query(del(card)), /permission denied/);
  assert.equal(await count(db, `public.oj_cards where id='${card}'`), 1);
  await as(db, oscar); await db.query(del(card));
  await assert.rejects(() => db.query(del(card)), /no longer exists/);
  assert.equal(await count(db, `public.oj_cards where id='${foreign}'`), 1);
});

test('a task someone is working on, or on the leaderboard untracked list, can still be deleted; running the script twice is harmless', async () => {
  const db = await setup(true);
  await db.exec(`reset role; insert into public.oj_current_work(organization_id,user_id,note,card_id) values ('${org}','${oscar}','on it','${card}'); insert into oj_private.untracked_done_cards(card_id) values ('${card}') on conflict do nothing;`);
  await as(db, oscar); await db.query(del(card));
  assert.equal(await count(db, `public.oj_cards where id='${card}'`), 0);
  assert.equal(await count(db, `public.oj_current_work where organization_id='${org}' and card_id is null`), 1, 'the note stays, without the task');
  await db.exec(await script());
});
