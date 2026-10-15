import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ventureIds } from '../src/lib/ventures';
import { centralWeek, scoreFrom, workBusinessIds } from '../src/lib/work';

const org = '00000000-0000-4000-8000-000000000001';
const otherOrg = '00000000-0000-4000-8000-000000000002';
const oscar = '00000000-0000-4000-8000-000000000011';
const jacob = '00000000-0000-4000-8000-000000000012';
const viewer = '00000000-0000-4000-8000-000000000013';
const outsider = '00000000-0000-4000-8000-000000000014';
const schema = (file: string) => readFile(new URL(`../supabase/schemas/${file}`, import.meta.url), 'utf8');

type Row = { week_start: string; starts_at: Date; ends_at: Date; user_id: string; worked_seconds: number; hours: string; tasks: number; task_ids: string[]; points: string; by_business: Record<string, number>; won: boolean };

/** The workspace schema plus the leaderboard, with Oscar (owner) and Jacob (member) as partners. */
async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${oscar}'),('${jacob}'),('${viewer}'),('${outsider}');`);
  await db.exec(await schema('workspace.sql'));
  await db.exec(await schema('work-leaderboard.sql'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${otherOrg}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${org}','${oscar}','owner','Oscar'),('${org}','${jacob}','member','Jacob'),('${org}','${viewer}','viewer','Viewer'),('${otherOrg}','${outsider}','member','Other');`);
  return db;
}
const as = (db: PGlite, id: string, role = 'authenticated') => db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role ${role};`);
const asAdmin = (db: PGlite) => db.exec(`reset role; set request.jwt.claim.sub = '';`);

/** Writes history directly, as an administrator with triggers off, so past dates can be set. */
async function seed(db: PGlite, sql: string) {
  await asAdmin(db);
  await db.exec(`set session_replication_role = replica; ${sql}; set session_replication_role = origin;`);
}
let n = 0;
const id = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`;
const session = (user: string, start: string, end: string | null, extra: { business?: string; checkin?: string; reason?: string; note?: string } = {}) => {
  const sid = id();
  return { sid, sql: `insert into public.oj_work_sessions(id,organization_id,user_id,business,started_at,ended_at,last_checkin_at,ended_reason,note) values
    ('${sid}','${org}','${user}','${extra.business ?? 'general'}',${start},${end ?? 'null'},${extra.checkin ?? end ?? start},${extra.reason ? `'${extra.reason}'` : end ? `'manual'` : 'null'},'${extra.note ?? ''}')` };
};
const ts = (iso: string) => `'${iso}'::timestamptz`;
const card = (by: string, done: string | null, created: string, completer: string | null, cid = id()) =>
  ({ cid, sql: `insert into public.oj_cards(id,organization_id,title,business,stage,created_by,created_at,completed_by,completed_at) values
    ('${cid}','${org}','Task ${cid.slice(-4)}','exterior','${done ? 'Done' : 'Backlog'}','${by}',${created},${completer ? `'${completer}'` : 'null'},${done ?? 'null'})` });

async function scores(db: PGlite, who = oscar) {
  await as(db, who);
  return (await db.query<Row>(`select * from public.oj_work_scores('${org}')`)).rows;
}
// PGlite returns a date column as a JS Date at UTC midnight.
const dateKey = (d: unknown) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
const week = (rows: Row[], start: string, user: string) => {
  const hit = rows.filter(x => dateKey(x.week_start) === start && x.user_id === user);
  assert.equal(hit.length, 1, `one row for ${user} in week ${start}`);
  return hit[0];
};
const total = (rows: Row[], user: string) => rows.filter(r => r.user_id === user).reduce((s, r) => s + Number(r.worked_seconds), 0);

test('Work sessions: partners only, own timer only, the database keeps the time', async t => {
  const db = await setup();

  await t.test('a partner starts their own timer; the start time is the database clock, whatever is sent', async () => {
    await as(db, oscar);
    await db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','exterior')`);
    const row = (await db.query<{ user_id: string; age: number; checkin_same: boolean }>(`select user_id, extract(epoch from now() - started_at) as age, last_checkin_at = started_at as checkin_same from public.oj_work_sessions`)).rows[0];
    assert.equal(row.user_id, oscar);
    assert.ok(Math.abs(Number(row.age)) < 5);
    assert.equal(row.checkin_same, true);
    // A start time, check-in or end cannot even be sent.
    await assert.rejects(db.exec(`insert into public.oj_work_sessions(organization_id,business,started_at) values ('${org}','general','2020-01-01')`));
    // Even an administrator's insert has its times set by the database.
    await asAdmin(db);
    await db.exec(`insert into public.oj_work_sessions(organization_id,user_id,business,started_at,last_checkin_at,ended_at,ended_reason) values ('${org}','${jacob}','general','2020-01-01','2020-01-01','2020-01-02','manual')`);
    const forced = (await db.query<{ old: boolean; open: boolean }>(`select started_at < now() - interval '1 day' as old, ended_at is null as open from public.oj_work_sessions where user_id='${jacob}'`)).rows[0];
    assert.deepEqual(forced, { old: false, open: true });
  });

  await t.test('one running timer per person', async () => {
    await as(db, oscar);
    await assert.rejects(db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','solutions')`), /oj_work_sessions_one_open|duplicate/);
  });

  await t.test('nobody starts a timer for someone else, and viewers and outsiders start none', async () => {
    await as(db, oscar);
    await assert.rejects(db.exec(`insert into public.oj_work_sessions(organization_id,user_id,business) values ('${org}','${viewer}','general')`));
    await as(db, viewer);
    await assert.rejects(db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','general')`));
    await as(db, outsider);
    await assert.rejects(db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','general')`));
  });

  await t.test('both partners read every session; viewers, other workspaces and signed-out visitors read none', async () => {
    for (const who of [oscar, jacob]) { await as(db, who); assert.equal((await db.query(`select id from public.oj_work_sessions`)).rows.length, 2); }
    for (const who of [viewer, outsider]) { await as(db, who); assert.equal((await db.query(`select id from public.oj_work_sessions`)).rows.length, 0); }
    await as(db, '', 'anon');
    await assert.rejects(db.query(`select id from public.oj_work_sessions`));
  });

  await t.test("a partner cannot check in, stop, edit or delete the other partner's timer", async () => {
    await as(db, oscar);
    assert.equal((await db.query(`update public.oj_work_sessions set ended_reason='manual', ended_at=now() where user_id='${jacob}' returning id`)).rows.length, 0);
    assert.equal((await db.query(`update public.oj_work_sessions set last_checkin_at=now() where user_id='${jacob}' returning id`)).rows.length, 0);
    await assert.rejects(db.exec(`delete from public.oj_work_sessions`));
    await assert.rejects(db.exec(`update public.oj_work_sessions set user_id='${jacob}' where user_id='${oscar}'`));
  });

  await t.test('a running timer is checked in or stopped, never rewritten', async () => {
    await as(db, oscar);
    await assert.rejects(db.exec(`update public.oj_work_sessions set business='general' where user_id='${oscar}'`), /checked in or stopped/);
    await assert.rejects(db.exec(`update public.oj_work_sessions set started_at=started_at - interval '3 hours' where user_id='${oscar}'`), /checked in or stopped/);
    await assert.rejects(db.exec(`update public.oj_work_sessions set ended_reason='edited', ended_at=now() where user_id='${oscar}'`), /by hand/);
    // An early "idle" stop (no check-in due yet) is refused rather than throwing time away by accident.
    await assert.rejects(db.exec(`update public.oj_work_sessions set ended_reason='idle', ended_at=now() where user_id='${oscar}'`), /by hand/);
    // A check-in moves to the database clock, not to the value sent.
    await db.exec(`update public.oj_work_sessions set last_checkin_at='2000-01-01' where user_id='${oscar}'`);
    assert.equal((await db.query<{ ok: boolean }>(`select last_checkin_at > now() - interval '1 minute' as ok from public.oj_work_sessions where user_id='${oscar}'`)).rows[0].ok, true);
    // A manual stop ends now, whatever end time is sent.
    await db.exec(`update public.oj_work_sessions set ended_reason='manual', ended_at='2099-01-01' where user_id='${oscar}'`);
    const stopped = (await db.query<{ reason: string; recent: boolean }>(`select ended_reason as reason, ended_at > now() - interval '1 minute' and ended_at <= now() as recent from public.oj_work_sessions where user_id='${oscar}'`)).rows[0];
    assert.deepEqual(stopped, { reason: 'manual', recent: true });
    // After stopping, a new timer can start.
    await db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','essentials')`);
  });

  await t.test('the business is general or one of the businesses in ventures.ts, and nothing else', async () => {
    assert.deepEqual([...workBusinessIds], ['general', ...ventureIds]);
    await as(db, jacob);
    await db.exec(`update public.oj_work_sessions set ended_reason='manual' where user_id='${jacob}' and ended_at is null`);
    for (const business of workBusinessIds) {
      await db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','${business}')`);
      await db.exec(`update public.oj_work_sessions set ended_reason='manual' where user_id='${jacob}' and ended_at is null`);
    }
    await assert.rejects(db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','unknown')`));
    // Task cards accept the same businesses (less "general"), so a business added to one is added to all.
    for (const business of ventureIds) await db.exec(`insert into public.oj_cards(organization_id,title,business) values ('${org}','Business check','${business}')`);
  });
  await db.close();
});

test('Idle timers end at their last check-in', async t => {
  const db = await setup();
  // Jacob: started three hours ago, last confirmed 80 minutes ago. Oscar: confirmed 65 minutes ago (prompt showing, not yet ended).
  const stale = session(jacob, `now() - interval '3 hours'`, null, { checkin: `now() - interval '80 minutes'`, business: 'solutions' });
  const due = session(oscar, `now() - interval '2 hours'`, null, { checkin: `now() - interval '65 minutes'` });
  await seed(db, `${stale.sql}; ${due.sql}`);

  await t.test('before anyone closes it, scoring already stops the idle timer at its last check-in', async () => {
    const rows = await scores(db);
    // 3 hours minus 80 minutes = 100 minutes.
    assert.ok(Math.abs(total(rows, jacob) - 6000) <= 2, `Jacob has ${total(rows, jacob)} seconds`);
    // Oscar's prompt is showing but not ignored yet: his time runs to now.
    assert.ok(Math.abs(total(rows, oscar) - 7200) <= 2, `Oscar has ${total(rows, oscar)} seconds`);
  });

  await t.test('the idle timer cannot be checked in any more', async () => {
    await as(db, jacob);
    await assert.rejects(db.exec(`update public.oj_work_sessions set last_checkin_at=now() where id='${stale.sid}'`), /already ended at its last check-in/);
  });

  await t.test('viewers, outsiders and signed-out visitors cannot run the close', async () => {
    for (const who of [viewer, outsider]) { await as(db, who); await assert.rejects(db.query(`select public.oj_close_idle_work('${org}')`)); }
    await as(db, '', 'anon');
    await assert.rejects(db.query(`select public.oj_close_idle_work('${org}')`));
  });

  await t.test("loading the app as either partner closes it at the last check-in, as idle, even the other partner's", async () => {
    await as(db, oscar);
    const closed = (await db.query<{ n: number }>(`select public.oj_close_idle_work('${org}') as n`)).rows[0].n;
    assert.equal(closed, 1);
    const row = (await db.query<{ reason: string; at_checkin: boolean }>(`select ended_reason as reason, ended_at = last_checkin_at as at_checkin from public.oj_work_sessions where id='${stale.sid}'`)).rows[0];
    assert.deepEqual(row, { reason: 'idle', at_checkin: true });
    // Oscar's timer (65 minutes, still within its 10 minutes to answer) is left running.
    assert.equal((await db.query(`select id from public.oj_work_sessions where id='${due.sid}' and ended_at is null`)).rows.length, 1);
    assert.equal((await db.query<{ n: number }>(`select public.oj_close_idle_work('${org}') as n`)).rows[0].n, 0);
    assert.ok(Math.abs(total(await scores(db), jacob) - 6000) <= 2);
  });

  await t.test('answering "No" once the check-in is due ends the timer at the last check-in', async () => {
    await as(db, oscar);
    await db.exec(`update public.oj_work_sessions set ended_reason='idle', ended_at=now() where id='${due.sid}'`);
    const row = (await db.query<{ reason: string; minutes: number }>(`select ended_reason as reason, round(extract(epoch from ended_at - started_at) / 60) as minutes from public.oj_work_sessions where id='${due.sid}'`)).rows[0];
    assert.deepEqual({ reason: row.reason, minutes: Number(row.minutes) }, { reason: 'idle', minutes: 55 });
  });

  await t.test('stopping a timer by hand after the check-in ran out still ends it at the last check-in', async () => {
    const late = session(oscar, `now() - interval '4 hours'`, null, { checkin: `now() - interval '2 hours'` });
    await seed(db, late.sql);
    await as(db, oscar);
    await db.exec(`update public.oj_work_sessions set ended_reason='manual', ended_at=now() where id='${late.sid}'`);
    const row = (await db.query<{ reason: string; minutes: number }>(`select ended_reason as reason, round(extract(epoch from ended_at - started_at) / 60) as minutes from public.oj_work_sessions where id='${late.sid}'`)).rows[0];
    assert.deepEqual({ reason: row.reason, minutes: Number(row.minutes) }, { reason: 'idle', minutes: 120 });
  });

  await t.test('a new timer can start once the idle one is closed', async () => {
    await as(db, jacob);
    await db.exec(`insert into public.oj_work_sessions(organization_id,business) values ('${org}','general')`);
  });
  await db.close();
});

test('Editing a finished session needs a note and is marked as edited', async t => {
  const db = await setup();
  const done = session(oscar, ts('2026-09-14T14:00:00Z'), ts('2026-09-14T16:00:00Z'), { business: 'exterior' });
  const next = session(oscar, ts('2026-09-14T18:00:00Z'), ts('2026-09-14T19:00:00Z'));
  const jacobs = session(jacob, ts('2026-09-14T14:00:00Z'), ts('2026-09-14T15:00:00Z'));
  await seed(db, `${done.sql}; ${next.sql}; ${jacobs.sql}`);
  const edit = (set: string, sid = done.sid) => db.exec(`update public.oj_work_sessions set ${set} where id='${sid}'`);

  await t.test('without a note it is refused', async () => {
    await as(db, oscar);
    await assert.rejects(edit(`ended_at='2026-09-14T16:30:00Z'`), /Say why/);
    await assert.rejects(edit(`ended_at='2026-09-14T16:30:00Z', note='   '`), /Say why/);
  });
  await t.test('it cannot end in the future, run past 24 hours, end before it starts, overlap, or reopen', async () => {
    await as(db, oscar);
    await assert.rejects(edit(`ended_at=now() + interval '1 hour', note='x'`), /future/);
    await assert.rejects(edit(`ended_at='2026-09-15T15:00:00Z', note='x'`), /24 hours/);
    await assert.rejects(edit(`ended_at='2026-09-14T13:00:00Z', note='x'`), /end after it starts/);
    await assert.rejects(edit(`ended_at='2026-09-14T18:30:00Z', note='x'`), /overlaps/);
    await assert.rejects(edit(`ended_at=null, ended_reason=null, note='x'`), /cannot be restarted/);
  });
  await t.test("the other partner's sessions cannot be edited", async () => {
    await as(db, oscar);
    assert.equal((await db.query(`update public.oj_work_sessions set ended_at='2026-09-14T15:30:00Z', note='x' where id='${jacobs.sid}' returning id`)).rows.length, 0);
  });
  await t.test('with a note it saves, is marked edited, and counts the new times', async () => {
    await as(db, oscar);
    await edit(`started_at='2026-09-14T13:30:00Z', ended_at='2026-09-14T16:30:00Z', business='solutions', note='Forgot to start the timer'`);
    const row = (await db.query<{ ended_reason: string; note: string; business: string }>(`select ended_reason, note, business from public.oj_work_sessions where id='${done.sid}'`)).rows[0];
    assert.deepEqual(row, { ended_reason: 'edited', note: 'Forgot to start the timer', business: 'solutions' });
    const w = week(await scores(db), '2026-09-14', oscar);
    assert.equal(Number(w.worked_seconds), 3 * 3600 + 3600);
    assert.deepEqual(w.by_business, { solutions: 3 * 3600, general: 3600 });
  });
  await db.close();
});

test('Finishing a task records who finished it and when', async t => {
  const db = await setup();
  const cid = id();
  await t.test('moving a card to Done stamps the person and time; moving it out clears them', async () => {
    await as(db, oscar);
    await db.exec(`insert into public.oj_cards(id,organization_id,title,business) values ('${cid}','${org}','Quote the Smith driveway','exterior')`);
    const get = async () => (await db.query<{ completed_by: string | null; recent: boolean | null }>(`select completed_by, completed_at > now() - interval '1 minute' as recent from public.oj_cards where id='${cid}'`)).rows[0];
    assert.deepEqual(await get(), { completed_by: null, recent: null });
    await as(db, jacob);
    await db.exec(`update public.oj_cards set stage='Done', revision=0 where id='${cid}'`);
    assert.deepEqual(await get(), { completed_by: jacob, recent: true });
    // A later edit by someone else while it stays Done keeps the original finisher.
    await as(db, oscar);
    await db.exec(`update public.oj_cards set title='Quote the Smith driveway (sent)', revision=1 where id='${cid}'`);
    assert.equal((await get()).completed_by, jacob);
    await db.exec(`update public.oj_cards set stage='Review', revision=2 where id='${cid}'`);
    assert.deepEqual(await get(), { completed_by: null, recent: null });
  });
  await t.test('the finisher and finish time cannot be written by a member', async () => {
    await as(db, oscar);
    await assert.rejects(db.exec(`update public.oj_cards set completed_by='${jacob}' where id='${cid}'`));
    await assert.rejects(db.exec(`update public.oj_cards set completed_at=now() where id='${cid}'`));
    // Sent on insert, they are replaced by the real values.
    const other = id();
    await db.exec(`insert into public.oj_cards(id,organization_id,title,business,stage,completed_by,completed_at) values ('${other}','${org}','Born done','solutions','Done','${jacob}','2020-01-01')`);
    const row = (await db.query<{ completed_by: string; recent: boolean }>(`select completed_by, completed_at > now() - interval '1 minute' as recent from public.oj_cards where id='${other}'`)).rows[0];
    assert.deepEqual(row, { completed_by: oscar, recent: true });
  });
  await t.test('a new card cannot be back-dated', async () => {
    await as(db, oscar);
    const old = id();
    await db.exec(`insert into public.oj_cards(id,organization_id,title,business,created_at) values ('${old}','${org}','Back-dated','exterior','2020-01-01')`);
    assert.equal((await db.query<{ recent: boolean }>(`select created_at > now() - interval '1 minute' as recent from public.oj_cards where id='${old}'`)).rows[0].recent, true);
  });
  await db.close();
});

test('Weeks run Monday to Monday in Central time, through both clock changes', async t => {
  const db = await setup();
  // Week of Oct 5, 2026 ends Monday Oct 12 00:00 CDT = 05:00Z. A UTC week would end 5 hours earlier.
  const crossing = session(oscar, ts('2026-10-12T04:00:00Z'), ts('2026-10-12T06:00:00Z'), { business: 'exterior' });
  // Spring forward, Sunday March 8 2026: the week of March 2 starts 06:00Z (CST) and ends 05:00Z (CDT): 167 hours.
  const springGap = session(oscar, ts('2026-03-08T07:30:00Z'), ts('2026-03-08T08:30:00Z'));      // 01:30 CST to 03:30 CDT: one real hour
  const springEdge = session(oscar, ts('2026-03-09T04:30:00Z'), ts('2026-03-09T05:30:00Z'));     // Sun 23:30 CDT to Mon 00:30 CDT
  // Fall back, Sunday November 2 2025: the week of October 27 starts 05:00Z (CDT) and ends 06:00Z (CST): 169 hours.
  const fallRepeat = session(jacob, ts('2025-11-02T05:30:00Z'), ts('2025-11-02T08:30:00Z'));     // 00:30 CDT to 02:30 CST: three real hours
  const fallEdge = session(jacob, ts('2025-11-03T05:30:00Z'), ts('2025-11-03T06:30:00Z'));       // Sun 23:30 CST to Mon 00:30 CST
  // Tasks created by the other partner, finished one second either side of Monday 00:00 CDT on Oct 12, 2026.
  const before = card(jacob, ts('2026-10-12T04:59:59Z'), ts('2026-10-01T00:00:00Z'), oscar);
  const after = card(jacob, ts('2026-10-12T05:00:00Z'), ts('2026-10-01T00:00:00Z'), oscar);
  await seed(db, [crossing, springGap, springEdge, fallRepeat, fallEdge, before, after].map(x => x.sql).join(';'));
  const rows = await scores(db);

  await t.test('a session over Sunday midnight is split between the two weeks', () => {
    assert.equal(Number(week(rows, '2026-10-05', oscar).worked_seconds), 3600);
    assert.equal(Number(week(rows, '2026-10-12', oscar).worked_seconds), 3600);
    assert.deepEqual(week(rows, '2026-10-05', oscar).by_business, { exterior: 3600 });
  });
  await t.test('a task finished at 23:59:59 Sunday counts for that week; one at 00:00 Monday for the next', () => {
    assert.deepEqual(week(rows, '2026-10-05', oscar).task_ids, [before.cid]);
    assert.deepEqual(week(rows, '2026-10-12', oscar).task_ids, [after.cid]);
  });
  await t.test('week edges are Central midnight, so weeks are 167 and 169 hours when the clocks change', () => {
    const spring = week(rows, '2026-03-02', oscar), fall = week(rows, '2025-10-27', jacob), plain = week(rows, '2026-10-12', oscar);
    assert.equal(spring.starts_at.toISOString(), '2026-03-02T06:00:00.000Z');
    assert.equal(spring.ends_at.toISOString(), '2026-03-09T05:00:00.000Z');
    assert.equal(fall.starts_at.toISOString(), '2025-10-27T05:00:00.000Z');
    assert.equal(fall.ends_at.toISOString(), '2025-11-03T06:00:00.000Z');
    assert.equal(plain.starts_at.toISOString(), '2026-10-12T05:00:00.000Z');
    assert.equal((spring.ends_at.getTime() - spring.starts_at.getTime()) / 3_600_000, 167);
    assert.equal((fall.ends_at.getTime() - fall.starts_at.getTime()) / 3_600_000, 169);
  });
  await t.test('time across a clock change counts real time, not clock time', () => {
    // Spring: one real hour (01:30 to 03:30 on the clock) plus the first half of the Sunday-night session.
    assert.equal(Number(week(rows, '2026-03-02', oscar).worked_seconds), 3600 + 1800);
    assert.equal(Number(week(rows, '2026-03-09', oscar).worked_seconds), 1800);
    // Fall: three real hours (00:30 to 02:30 on the clock) plus the first half of the Sunday-night session.
    assert.equal(Number(week(rows, '2025-10-27', jacob).worked_seconds), 3 * 3600 + 1800);
    assert.equal(Number(week(rows, '2025-11-03', jacob).worked_seconds), 1800);
  });
  await t.test('every week from the first recorded work to now is listed for both partners, empty weeks included', () => {
    const starts = [...new Set(rows.map(r => dateKey(r.week_start)))].sort();
    assert.equal(starts[0], '2025-10-27');
    for (let i = 1; i < starts.length; i++) assert.equal(Date.parse(starts[i]) - Date.parse(starts[i - 1]), 7 * 86_400_000);
    assert.equal(starts.at(-1), centralWeek(Date.now()).weekStart);
    assert.equal(rows.length, starts.length * 2);
    assert.equal(Number(week(rows, '2026-01-05', oscar).points), 0);
  });
  await t.test("the browser's week (used by the sample workspace) agrees with the database at every edge", async () => {
    await as(db, oscar);
    const instants = ['2026-03-02T05:59:59Z', '2026-03-02T06:00:00Z', '2026-03-08T07:59:59Z', '2026-03-08T08:00:00Z', '2026-03-09T04:59:59Z', '2026-03-09T05:00:00Z',
      '2025-11-02T06:30:00Z', '2025-11-02T07:30:00Z', '2025-11-03T05:59:59Z', '2025-11-03T06:00:00Z', '2026-10-12T04:59:59Z', '2026-10-12T05:00:00Z', '2026-12-31T23:00:00Z', '2027-01-04T06:00:00Z'];
    for (const at of instants) {
      const sql = (await db.query<{ start: string; s: Date; e: Date }>(`select date_trunc('week', '${at}'::timestamptz at time zone 'America/Chicago')::date::text as start,
        date_trunc('week', '${at}'::timestamptz at time zone 'America/Chicago') at time zone 'America/Chicago' as s,
        (date_trunc('week', '${at}'::timestamptz at time zone 'America/Chicago') + interval '7 days') at time zone 'America/Chicago' as e`)).rows[0];
      assert.deepEqual(centralWeek(Date.parse(at)), { weekStart: sql.start, startsAt: sql.s.toISOString(), endsAt: sql.e.toISOString() }, at);
    }
  });
  await db.close();
});

test('Anti-farming: a task scores only if it was made 12 hours ahead, or by the other partner', async t => {
  const db = await setup();
  const at = (h: number) => ts(new Date(Date.parse('2026-09-21T15:00:00Z') + h * 3_600_000).toISOString()); // Monday Sept 21, 10:00 CDT
  const quick = card(oscar, at(11 + 59 / 60), at(0), oscar);        // own task, 11h59m: does not count
  const exact = card(oscar, at(36), at(24), oscar);                  // own task, exactly 12h: counts
  const fromJacob = card(jacob, at(48 + 1 / 60), at(48), oscar);     // Jacob's task, finished a minute later by Oscar: counts for Oscar
  const forJacob = card(oscar, at(50), at(49.5), jacob);             // Oscar's task, finished by Jacob: counts for Jacob, not Oscar
  const unknown = card(oscar, null, at(0), null);                    // never finished
  await seed(db, [quick, exact, fromJacob, forJacob, unknown].map(x => x.sql).join(';'));
  // A card already Done before completion was recorded (completed_at unknown) never scores.
  await seed(db, `insert into public.oj_cards(organization_id,title,business,stage,created_by,created_at) values ('${org}','Done long ago','exterior','Done','${oscar}','2026-09-01')`);

  await t.test('only qualifying tasks count, and they count for whoever finished them', async () => {
    const rows = await scores(db);
    const o = week(rows, '2026-09-21', oscar), j = week(rows, '2026-09-21', jacob);
    assert.deepEqual([...o.task_ids].sort(), [exact.cid, fromJacob.cid].sort());
    assert.equal(o.tasks, 2);
    assert.equal(Number(o.points), 6);
    assert.deepEqual(j.task_ids, [forJacob.cid]);
    assert.equal(Number(j.points), 3);
  });

  await t.test('in the live app: an own task finished straight away scores nothing; one from the other partner scores at once', async () => {
    await as(db, oscar);
    const own = id(), theirs = id();
    // Sent with a back-dated created_at, which the database replaces with now.
    await db.exec(`insert into public.oj_cards(id,organization_id,title,business,created_at) values ('${own}','${org}','Own quick task','solutions','2020-01-01')`);
    await db.exec(`update public.oj_cards set stage='Done', revision=0 where id='${own}'`);
    await as(db, jacob);
    await db.exec(`insert into public.oj_cards(id,organization_id,title,business) values ('${theirs}','${org}','Jacob asks Oscar','solutions')`);
    await as(db, oscar);
    await db.exec(`update public.oj_cards set stage='Done', revision=0 where id='${theirs}'`);
    // Done, back to Review, Done again: still one task.
    await db.exec(`update public.oj_cards set stage='Review', revision=1 where id='${theirs}'`);
    await db.exec(`update public.oj_cards set stage='Done', revision=2 where id='${theirs}'`);
    const rows = await scores(db);
    const current = rows.filter(r => r.user_id === oscar && dateKey(r.week_start) === centralWeek(Date.now()).weekStart);
    assert.equal(current.length, 1);
    assert.deepEqual(current[0].task_ids, [theirs]);
  });
  await db.close();
});

test('Points: hours to the minute plus 3 per task; the browser arithmetic matches the database; winners and ties', async t => {
  const db = await setup();
  const w = (h: number) => ts(new Date(Date.parse('2026-08-03T14:00:00Z') + h * 3_600_000).toISOString()); // Monday Aug 3 09:00 CDT
  const parts = [
    session(oscar, w(0), ts(new Date(Date.parse('2026-08-03T14:00:00Z') + 119_000).toISOString())), // 1 min 59 s: one whole minute
    session(oscar, w(24), w(25.5), { business: 'exterior' }),                                           // 90 minutes
    session(jacob, w(2), w(4), { business: 'essentials' }),
    session(jacob, w(30), w(30 + 17 / 60)),
    // Week of Aug 10: a tie. Week of Aug 17: nothing at all.
    session(oscar, w(170), w(172)), session(jacob, w(171), w(173)),
  ];
  const tasks = [card(jacob, w(5), w(1), oscar), card(oscar, w(6), w(1), jacob), card(oscar, w(7), w(1), jacob)];
  await seed(db, [...parts, ...tasks].map(x => x.sql).join(';'));
  const rows = await scores(db);

  await t.test('whole minutes only, hours to two decimals, plus 3 per task', () => {
    const o = week(rows, '2026-08-03', oscar), j = week(rows, '2026-08-03', jacob);
    assert.equal(Number(o.worked_seconds), 119 + 5400);
    assert.equal(Number(o.hours), 1.52);                    // 91 minutes
    assert.equal(Number(o.points), 4.52);                   // 1.52 + one task
    assert.equal(Number(j.hours), 2.28);                    // 137 minutes
    assert.equal(Number(j.points), 8.28);                   // 2.28 + two tasks
    assert.deepEqual(o.by_business, { general: 119, exterior: 5400 });
  });
  await t.test("the browser's live arithmetic gives the database's figures for every row", () => {
    for (const r of rows) assert.deepEqual(
      { hours: scoreFrom(Number(r.worked_seconds), r.tasks).hours, points: scoreFrom(Number(r.worked_seconds), r.tasks).points },
      { hours: Number(r.hours), points: Number(r.points) }, `${dateKey(r.week_start)} ${r.user_id}`);
  });
  await t.test('and for every minute count up to 100 hours', async () => {
    const sql = (await db.query<{ m: number; h: string }>(`select m, round(floor(m * 60 / 60.0) / 60.0, 2)::text as h from generate_series(0, 6000) m`)).rows;
    for (const { m, h } of sql) assert.equal(scoreFrom(m * 60 + 59, 0).hours, Number(h), `${m} minutes`);
  });
  await t.test('a finished week goes to the sole highest score; ties, empty weeks and the current week have no winner', () => {
    assert.equal(week(rows, '2026-08-03', jacob).won, true);
    assert.equal(week(rows, '2026-08-03', oscar).won, false);
    assert.equal(week(rows, '2026-08-10', oscar).won, false);
    assert.equal(week(rows, '2026-08-10', jacob).won, false);
    assert.equal(Number(week(rows, '2026-08-10', jacob).points), Number(week(rows, '2026-08-10', oscar).points));
    assert.equal(rows.filter(r => dateKey(r.week_start) === '2026-08-17' && r.won).length, 0);
    const current = centralWeek(Date.now()).weekStart;
    assert.equal(rows.filter(r => dateKey(r.week_start) === current && r.won).length, 0);
  });
  await t.test('viewers, other workspaces and signed-out visitors get no scores', async () => {
    for (const who of [viewer, outsider]) { await as(db, who); await assert.rejects(db.query(`select * from public.oj_work_scores('${org}')`)); }
    await as(db, '', 'anon');
    await assert.rejects(db.query(`select * from public.oj_work_scores('${org}')`));
  });
  await db.close();
});

test('The paste-ready update contains the desired state word for word, and refuses a second run without changing anything', async () => {
  const runMe = await readFile(new URL('../supabase/pending/RUN-ME-work-leaderboard.sql', import.meta.url), 'utf8');
  const desired = await schema('work-leaderboard.sql');
  assert.ok(runMe.includes(desired), 'RUN-ME-work-leaderboard.sql must contain supabase/schemas/work-leaderboard.sql unchanged');
  assert.match(runMe, /^begin;$/m);
  assert.match(runMe, /^commit;$/m);
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;`);
  await db.exec(await schema('workspace.sql'));
  await db.exec(runMe);
  await assert.rejects(db.exec(runMe));
  await db.exec('rollback').catch(() => undefined);
  assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from pg_trigger where tgname = 'stamp_card_completion'`)).rows[0].n, 1);
  await db.close();
});
