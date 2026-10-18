import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const oscar = '00000000-0000-4000-8000-000000000011', jacob = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
const token = 'a'.repeat(64);
const digest = (t: string) => createHash('sha256').update(t).digest('hex');
const day = (n: number, hour = 16) => { const d = new Date(Date.UTC(2026, 9, 20 + n, hour)); return d.toISOString(); };
const from = day(-10, 0), to = day(60, 0);
const shift = (n: number, extra: Record<string, unknown> = {}) => ({ id: `cal-${n}`, title: 'Oscar at work', starts_at: day(n), ends_at: day(n, 22), all_day: false, ...extra });

async function setup(applySync = true) {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${oscar}'),('${jacob}'),('${stranger}');`);
  for (const file of ['workspace', 'dashboard']) await db.exec(await readFile(new URL(`../supabase/schemas/${file}.sql`, import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${org}','${oscar}','owner','Oscar'),('${org}','${jacob}','member','Jacob'),('${other}','${stranger}','member','Stranger');
    insert into public.oj_events(organization_id,title,starts_at,created_by) values ('${org}','Hand-made event','${day(3)}','${jacob}');`);
  if (applySync) await db.exec(await readFile(new URL('../supabase/schemas/work-calendar-sync.sql', import.meta.url), 'utf8'));
  const as = async (id: string, role = 'authenticated') => { await db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`); };
  const register = async () => { await db.exec(`reset role; insert into oj_private.calendar_sources(organization_id,source,owner_id,token_hash) values ('${org}','strathos-work','${oscar}','${digest(token)}')`); };
  const sync = async (items: unknown[], t = token, f = from, u = to) => (await db.query<{ r: { synced: number; removed: number } }>(`select public.oj_sync_calendar($1, $2::jsonb, $3, $4) as r`, [t, JSON.stringify(items), f, u])).rows[0].r;
  const events = async () => (await db.exec('reset role'), await db.query<{ title: string; source: string | null; external_id: string | null; location: string; notes: string; venture: string | null; created_by: string }>(`select title, source, external_id, location, notes, venture, created_by from public.oj_events order by starts_at`)).rows;
  return { db, as, register, sync, events };
}

test('a sync adds, updates and removes only its own events, inside the window', async () => {
  const { db, as, register, sync, events } = await setup();
  await register(); await as('', 'anon');
  assert.deepEqual(await sync([shift(1), shift(2), shift(3)]), { synced: 3, removed: 0 });
  assert.equal((await events()).filter(e => e.source === 'strathos-work').length, 3);

  await as('', 'anon');
  assert.deepEqual(await sync([shift(1, { title: 'Oscar at work (late)' }), shift(3)]), { synced: 2, removed: 1 }, 'a shift dropped from the source disappears');
  const rows = await events();
  assert.equal(rows.filter(e => e.source === 'strathos-work').length, 2);
  assert.ok(rows.some(e => e.title === 'Oscar at work (late)'), 'a changed shift is updated in place, not duplicated');
  assert.ok(rows.some(e => e.title === 'Hand-made event' && e.source === null), 'hand-made events are never touched');

  await as('', 'anon');
  await assert.rejects(() => sync([shift(1), shift(3)], token, day(2, 0), to), /outside the window/i, 'an item before the window start is refused');
  assert.equal((await events()).filter(e => e.source).length, 2, 'and nothing changed');
  await db.close();
});

test('a call that sends nothing clears only synced events inside the window; stored fields are title and times only', async () => {
  const { db, as, register, sync, events } = await setup();
  await register(); await as('', 'anon');
  await sync([shift(1, { location: 'Grand Geneva', notes: 'paid 25/h', venture: 'exterior' })]);
  const [row] = (await events()).filter(e => e.source);
  assert.equal(row.location, ''); assert.equal(row.notes, ''); assert.equal(row.venture, null); assert.equal(row.created_by, oscar);
  await as('', 'anon');
  assert.deepEqual(await sync([]), { synced: 0, removed: 1 });
  assert.equal((await events()).length, 1, 'the hand-made event survives');
  await db.close();
});

test('the token is the only way in, and it stops working when the owner stops being an owner', async () => {
  const { db, as, register, sync } = await setup();
  await as('', 'anon');
  await assert.rejects(() => sync([shift(1)]), /Not authorised/i);       // nothing registered yet
  await register(); await as('', 'anon');
  for (const bad of ['', 'short', 'A'.repeat(64), 'b'.repeat(64), `${token}0`]) await assert.rejects(() => sync([shift(1)], bad), /Not authorised/i);
  await assert.rejects(() => db.query(`select public.oj_sync_calendar(null, '[]'::jsonb, now(), now() + interval '1 day')`), /Not authorised/i);
  await db.exec(`reset role; update public.oj_memberships set role = 'member' where user_id = '${oscar}'`); await as('', 'anon');
  await assert.rejects(() => sync([shift(1)]), /Not authorised/i);
  await db.close();
});

test('malformed input is refused whole, so a bad batch changes nothing', async () => {
  const { db, as, register, sync, events } = await setup();
  await register(); await as('', 'anon');
  await sync([shift(1)]);
  await as('', 'anon');
  for (const items of [
    [shift(2), { id: 'x', title: '', starts_at: day(2) }],
    [shift(2), shift(4, { ends_at: day(4, 1) })],                        // ends before it starts
    [shift(2), shift(90)],                                              // outside the window
    [shift(2), { ...shift(5), id: 'x'.repeat(121) }],
    Array.from({ length: 201 }, (_, i) => shift(i % 50, { id: `n${i}` })),
  ]) await assert.rejects(() => sync(items), /malformed|at most/i);
  await assert.rejects(() => sync([], token, from, day(400, 0)), /at most 200 days/i);
  await assert.rejects(() => sync([], token, to, from), /at most 200 days/i);
  assert.equal((await events()).filter(e => e.source).length, 1, 'the earlier good state is intact');
  await db.close();
});

test('members read synced events but cannot add, edit or remove them; hand-made events are unchanged', async () => {
  const { db, as, register, sync } = await setup();
  await register(); await as('', 'anon'); await sync([shift(1)]);
  for (const who of [jacob, oscar]) {
    await as(who);
    const read = await db.query(`select id from public.oj_events where source is not null`);
    assert.equal(read.rows.length, 1, 'visible to members');
    assert.equal((await db.query(`update public.oj_events set title = 'Edited' where source is not null returning id`)).rows.length, 0, 'not editable');
    assert.equal((await db.query(`delete from public.oj_events where source is not null returning id`)).rows.length, 0, 'not removable');
    await assert.rejects(() => db.exec(`insert into public.oj_events(organization_id,title,starts_at,created_by,source,external_id) values ('${org}','Fake','${day(5)}','${who}','strathos-work','spoof')`), /row-level security/i);
    await assert.rejects(() => db.exec(`update public.oj_events set source = null where source is not null`), /permission denied/i, 'source is not a column members may change');
  }
  await as(jacob);
  assert.equal((await db.query(`update public.oj_events set title = 'Renamed' where title = 'Hand-made event' returning id`)).rows.length, 1);
  assert.equal((await db.query(`delete from public.oj_events where title = 'Renamed' returning id`)).rows.length, 1);
  await db.exec(`insert into public.oj_events(organization_id,title,starts_at,created_by) values ('${org}','Another','${day(6)}','${jacob}')`);
  await as(stranger);
  assert.equal((await db.query(`select id from public.oj_events`)).rows.length, 0, 'another workspace sees nothing');
  await db.close();
});

test('signed-out visitors and members cannot reach the token table or call the sync without a token', async () => {
  const { db, as, register } = await setup();
  await register();
  for (const who of ['anon', 'authenticated']) {
    await as(jacob, who);
    await assert.rejects(() => db.query(`select * from oj_private.calendar_sources`), /permission denied/i);
  }
  await db.close();
});

test('the paste-ready copy equals the desired state and applies on top of rows that already exist', async () => {
  const dir = new URL('../supabase/pending/', import.meta.url);
  const pending = await readFile(new URL('RUN-ME-work-calendar-sync.sql', dir), 'utf8');
  const desired = await readFile(new URL('../supabase/schemas/work-calendar-sync.sql', import.meta.url), 'utf8');
  assert.ok(pending.includes(desired.split('\n').filter(l => !l.startsWith('--')).join('\n').trim()), 'the pending file carries the desired SQL unchanged');
  const { db } = await setup(false);
  await db.exec(pending);                                                  // existing hand-made row survives
  const counts = (await db.query<{ n: number }>(`select count(*)::int as n from public.oj_events where source is null`)).rows[0];
  assert.equal(counts.n, 1, 'the existing hand-made row is kept, with no source');
  await db.exec(`insert into public.oj_events(organization_id,title,starts_at,created_by) values ('${org}','Still works','${day(7)}','${jacob}')`);
  await db.close();
});
