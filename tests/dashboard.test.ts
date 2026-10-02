import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Dashboard tables enforce workspace isolation and roles', async t => {
  const db = new PGlite();
  const orgA = '00000000-0000-4000-8000-000000000001';
  const orgB = '00000000-0000-4000-8000-000000000002';
  const member = '00000000-0000-4000-8000-000000000011';
  const outsider = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  await db.exec(`create role authenticated; create role anon;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${member}'),('${outsider}'),('${viewer}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/dashboard.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${orgA}','OJ'),('${orgB}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${orgA}','${member}','member','Oscar'),('${orgA}','${viewer}','viewer','Viewer'),('${orgB}','${outsider}','member','Other');`);
  const as = async (id: string, role = 'authenticated') => { await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role ${role};`); };

  // One valid row per table, written by a member of orgA.
  const inserts: Record<string, string> = {
    oj_messages: `insert into public.oj_messages(organization_id,venture,body) values ('${orgA}','exterior','Hello')`,
    oj_leads: `insert into public.oj_leads(organization_id,venture,name) values ('${orgA}','solutions','Lead one')`,
    oj_finance_entries: `insert into public.oj_finance_entries(organization_id,venture,kind,amount,occurred_on) values ('${orgA}','essentials','revenue',120.50,'2026-10-01')`,
    oj_metric_entries: `insert into public.oj_metric_entries(organization_id,venture,label,value,measured_on) values ('${orgA}','solutions','Calls handled',42,'2026-10-01')`,
    oj_events: `insert into public.oj_events(organization_id,title,starts_at) values ('${orgA}','Weekly sync', now() + interval '1 day')`,
    oj_documents: `insert into public.oj_documents(organization_id,name,storage_path,size_bytes) values ('${orgA}','Insurance','${orgA}/abc/insurance.pdf',2048)`,
  };
  const tables = Object.keys(inserts);

  await t.test('member can add and read every kind of record', async () => {
    await as(member);
    for (const table of tables) {
      await db.exec(inserts[table]);
      assert.equal((await db.query(`select id from public.${table}`)).rows.length, 1, table);
    }
  });
  await t.test('viewer reads but cannot add, change or remove', async () => {
    await as(viewer);
    for (const table of tables) {
      assert.equal((await db.query(`select id from public.${table}`)).rows.length, 1, table);
      await assert.rejects(() => db.exec(inserts[table].replace('abc', 'viewer')), table);
    }
    assert.equal((await db.query(`update public.oj_leads set stage='Won' returning id`)).rows.length, 0);
    assert.equal((await db.query(`delete from public.oj_finance_entries returning id`)).rows.length, 0);
  });
  await t.test('another workspace sees nothing and cannot write in', async () => {
    await as(outsider);
    for (const table of tables) {
      assert.equal((await db.query(`select id from public.${table}`)).rows.length, 0, table);
      await assert.rejects(() => db.exec(inserts[table].replace('abc', 'outsider')), table);
    }
    assert.equal((await db.query(`delete from public.oj_leads returning id`)).rows.length, 0);
  });
  await t.test('signed-out access is denied', async () => {
    await as('', 'anon');
    for (const table of tables) await assert.rejects(() => db.query(`select id from public.${table}`), table);
  });
  await t.test('rows cannot be forged, moved or given impossible values', async () => {
    await as(member);
    await assert.rejects(() => db.exec(`insert into public.oj_messages(organization_id,author_id,body) values ('${orgA}','${viewer}','Forged')`));
    await assert.rejects(() => db.exec(`update public.oj_leads set organization_id='${orgB}'`));
    await assert.rejects(() => db.exec(`insert into public.oj_finance_entries(organization_id,venture,kind,amount,occurred_on) values ('${orgA}','exterior','revenue',-5,'2026-10-01')`));
    await assert.rejects(() => db.exec(`insert into public.oj_leads(organization_id,venture,name) values ('${orgA}','unknown','Bad business')`));
    await assert.rejects(() => db.exec(`insert into public.oj_events(organization_id,title,starts_at,ends_at) values ('${orgA}','Backwards', now(), now() - interval '1 hour')`));
    // A document row must point inside its own workspace's folder.
    await assert.rejects(() => db.exec(`insert into public.oj_documents(organization_id,name,storage_path,size_bytes) values ('${orgA}','Stolen','${orgB}/x/file.pdf',10)`));
    assert.equal((await db.query(`update public.oj_messages set body='edited' returning id`).catch(() => ({ rows: [] }))).rows.length, 0);
  });
  await t.test('member can move a lead and remove a finance entry', async () => {
    await as(member);
    assert.equal((await db.query(`update public.oj_leads set stage='Won' returning id`)).rows.length, 1);
    assert.equal((await db.query(`delete from public.oj_finance_entries returning id`)).rows.length, 1);
  });
  await t.test('calendar link returns the workspace calendar only for a valid token, and dies with membership', async () => {
    const token = 'a'.repeat(64);
    const digest = createHash('sha256').update(token).digest('hex');
    await as(outsider);
    await assert.rejects(() => db.exec(`select public.oj_set_calendar_feed('${orgA}','${digest}')`));
    await as(member);
    await db.exec(`select public.oj_set_calendar_feed('${orgA}','${digest}')`);
    await db.exec(`insert into public.oj_cards(organization_id,title,business,due_date) values ('${orgA}','Task with a date','exterior', current_date + 2)`);
    await as('', 'anon');
    const rows = (await db.query<{ title: string }>(`select title from public.oj_calendar_feed('${token}')`)).rows.map(r => r.title).sort();
    assert.deepEqual(rows, ['Task with a date', 'Weekly sync']);
    assert.equal((await db.query(`select * from public.oj_calendar_feed('${'b'.repeat(64)}')`)).rows.length, 0);
    assert.equal((await db.query(`select * from public.oj_calendar_feed('not-a-token')`)).rows.length, 0);
    await assert.rejects(() => db.query('select * from oj_private.calendar_feeds'));
    await db.exec(`reset role; delete from public.oj_memberships where user_id='${member}'`);
    await as('', 'anon');
    assert.equal((await db.query(`select * from public.oj_calendar_feed('${token}')`)).rows.length, 0);
  });
  await db.close();
});
