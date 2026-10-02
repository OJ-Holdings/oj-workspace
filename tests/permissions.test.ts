import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Database enforces workspace isolation, roles, revision conflicts and immutable activity', async t => {
  const db = new PGlite();
  const orgA = '00000000-0000-4000-8000-000000000001';
  const orgB = '00000000-0000-4000-8000-000000000002';
  const userA = '00000000-0000-4000-8000-000000000011';
  const userB = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  const cardA = '00000000-0000-4000-8000-000000000021';
  const cardB = '00000000-0000-4000-8000-000000000022';
  await db.exec(`create role authenticated; create role anon;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${userA}'),('${userB}'),('${viewer}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${orgA}','OJ'),('${orgB}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${orgA}','${userA}','owner','Oscar'),('${orgA}','${viewer}','viewer','Viewer'),('${orgB}','${userB}','member','Other');`);
  const as = async (id: string, role = 'authenticated') => {
    await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role ${role};`);
  };
  const create = async (id: string, org: string) => db.exec(`insert into public.oj_cards(id,organization_id,title,business) values ('${id}','${org}','Test card','exterior')`);
  await as(userA); await create(cardA, orgA);
  await as(userB); await create(cardB, orgB);
  await t.test('member reads only own organization', async () => {
    await as(userA);
    const { rows } = await db.query<{id:string}>('select id from public.oj_cards');
    assert.deepEqual(rows.map(r => r.id), [cardA]);
    assert.equal((await db.query('select * from public.oj_memberships')).rows.length, 2);
  });
  await t.test('cross-organization insert fails', async () => {
    await as(userA);
    await assert.rejects(() => create('00000000-0000-4000-8000-000000000023',orgB));
  });
  await t.test('cross-organization update affects no rows', async () => {
    await as(userA);
    const result = await db.query(`update public.oj_cards set title='Injected' where id='${cardB}' returning id`);
    assert.equal(result.rows.length, 0);
  });
  await t.test('cannot reassign organization or creator', async () => {
    await as(userA);
    await assert.rejects(() => db.exec(`update public.oj_cards set organization_id='${orgB}' where id='${cardA}'`));
    await assert.rejects(() => db.exec(`update public.oj_cards set created_by='${userB}' where id='${cardA}'`));
  });
  await t.test('cannot self-promote or forge audit entries', async () => {
    await as(viewer);
    await assert.rejects(() => db.exec(`update public.oj_memberships set role='owner' where user_id='${viewer}'`));
    await assert.rejects(() => db.exec(`insert into public.oj_activity(organization_id,card_id,actor_id,action) values ('${orgA}','${cardA}','${userA}','card_updated')`));
  });
  await t.test('viewer can read but cannot write', async () => {
    await as(viewer);
    assert.equal((await db.query('select * from public.oj_cards')).rows.length, 1);
    await assert.rejects(() => create('00000000-0000-4000-8000-000000000024',orgA));
    assert.equal((await db.query(`update public.oj_cards set title='Viewer edit' where id='${cardA}' returning id`)).rows.length, 0);
  });
  await t.test('anonymous access is denied', async () => {
    await as('', 'anon');
    await assert.rejects(() => db.query('select * from public.oj_cards'));
  });
  await t.test('comment cannot reference another organization or impersonate author', async () => {
    await as(userA);
    await assert.rejects(() => db.exec(`insert into public.oj_comments(organization_id,card_id,body) values ('${orgA}','${cardB}','Cross tenant')`));
    await assert.rejects(() => db.exec(`insert into public.oj_comments(organization_id,card_id,author_id,body) values ('${orgA}','${cardA}','${userB}','Forged author')`));
    await db.exec(`insert into public.oj_comments(organization_id,card_id,body) values ('${orgA}','${cardA}','Real comment')`);
  });
  await t.test('revision increments and stale updates cannot win', async () => {
    await as(userA);
    await db.exec(`update public.oj_cards set stage='Review',revision=0 where id='${cardA}' and revision=0`);
    const result = await db.query(`update public.oj_cards set title='Stale',revision=0 where id='${cardA}' and revision=0 returning id`);
    assert.equal(result.rows.length, 0);
    const row = (await db.query<{revision:number}>(`select revision from public.oj_cards where id='${cardA}'`)).rows[0];
    assert.equal(row.revision, 1);
    await assert.rejects(() => db.exec(`update public.oj_cards set revision=20 where id='${cardA}'`));
  });
  await t.test('malformed checklists and invalid assignees are rejected by database', async () => {
    await as(userA);
    await assert.rejects(() => db.exec(`update public.oj_cards set checklist='[{"id":"a","text":"task","done":"yes"}]' where id='${cardA}'`));
    await assert.rejects(() => db.exec(`update public.oj_cards set assignee='Not a member' where id='${cardA}'`));
  });
  await t.test('activity is generated by writes and cannot be deleted', async () => {
    await as(userA);
    const rows = (await db.query<{action:string}>('select action from public.oj_activity order by created_at')).rows;
    assert.deepEqual(rows.map(r => r.action), ['card_created','comment_added','card_updated']);
    await assert.rejects(() => db.exec('delete from public.oj_activity'));
  });
  await t.test('membership revocation removes access with same token identity', async () => {
    await db.exec(`reset role; delete from public.oj_memberships where user_id='${viewer}'`);
    await as(viewer);
    assert.equal((await db.query('select * from public.oj_cards')).rows.length, 0);
  });
  await db.close();
});
