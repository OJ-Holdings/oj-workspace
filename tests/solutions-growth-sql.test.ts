import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001';
const otherOrg = '00000000-0000-4000-8000-000000000002';
const oscar = '00000000-0000-4000-8000-000000000011';
const jacob = '00000000-0000-4000-8000-000000000012';
const viewer = '00000000-0000-4000-8000-000000000013';
const outsider = '00000000-0000-4000-8000-000000000014';
const p1 = '00000000-0000-4000-8000-0000000000a1';
const p2 = '00000000-0000-4000-8000-0000000000a2';
const p3 = '00000000-0000-4000-8000-0000000000a3';
const hex = (n: string) => n.repeat(64).slice(0, 64);

async function database() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${oscar}'),('${jacob}'),('${viewer}'),('${outsider}');`);
  for (const file of ['workspace.sql', 'outreach-pipeline.sql', 'solutions-dm-quests.sql', 'solutions-email-engine.sql']) {
    await db.exec(await readFile(new URL(`../supabase/schemas/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${otherOrg}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
      ('${org}','${oscar}','owner','Oscar'),('${org}','${jacob}','member','Jacob'),
      ('${org}','${viewer}','viewer','Viewer'),('${otherOrg}','${outsider}','owner','Outsider');
    insert into public.oj_outreach_prospects(id,organization_id,source_key,source_row,business_name,source_status) values
      ('${p1}','${org}','${hex('1')}',2,'Alpha Wash','Not Sent'),
      ('${p2}','${org}','${hex('2')}',3,'Bravo Wash','Emailed'),
      ('${p3}','${org}','${hex('3')}',4,'Charlie Wash','Replied');`);
  const as = (id: string) => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated;`);
  const asService = () => db.exec(`reset role; set request.jwt.claim.sub=''; set role service_role;`);
  const status = async (id: string) => (await db.query<{ s: string }>(`select coalesce(outreach_status, source_status) s from public.oj_outreach_prospects where id=$1`, [id])).rows[0].s;
  const dm = (prospect: string | null, channel = 'instagram', tenant = org) =>
    db.query<{ r: { ok: boolean; duplicate: boolean; id: string; today: number } }>('select public.oj_log_dm($1,$2,$3) r', [tenant, prospect, channel]);
  return { db, as, asService, status, dm };
}

test('Daily 10 log: members log DMs, statuses move once, and nothing is writable directly', async t => {
  const { db, as, status, dm } = await database();

  await t.test('a DM moves Not Sent to DMed with an audit row and counts once per prospect per day', async () => {
    await as(oscar);
    const first = await dm(p1);
    assert.equal(first.rows[0].r.today, 1);
    assert.equal(first.rows[0].r.duplicate, false);
    assert.equal(await status(p1), 'DMed');
    const again = await dm(p1);
    assert.equal(again.rows[0].r.duplicate, true);
    assert.equal(again.rows[0].r.today, 1);
    await db.exec('reset role');
    const audit = await db.query(`select previous_status,new_status from public.oj_outreach_activity where prospect_id='${p1}'`);
    assert.deepEqual(audit.rows, [{ previous_status: 'Not Sent', new_status: 'DMed' }]);
  });

  await t.test('Emailed becomes Emailed + DMed; later statuses are left alone; manual DMs are unlimited', async () => {
    await as(jacob);
    assert.equal((await dm(p2, 'facebook')).rows[0].r.today, 1);
    assert.equal(await status(p2), 'Emailed + DMed');
    assert.equal((await dm(p3)).rows[0].r.today, 2);
    assert.equal(await status(p3), 'Replied');
    assert.equal((await dm(null, 'other')).rows[0].r.today, 3);
    assert.equal((await dm(null, 'other')).rows[0].r.today, 4);
    await assert.rejects(() => dm(p1, 'smoke-signal'));
  });

  await t.test('both founders see the whole team log; viewers and outsiders see nothing and cannot log', async () => {
    await as(oscar);
    assert.equal((await db.query('select * from public.oj_outreach_dm_log')).rows.length, 5);
    await as(viewer);
    assert.equal((await db.query('select * from public.oj_outreach_dm_log')).rows.length, 0);
    await assert.rejects(() => dm(null));
    await as(outsider);
    assert.equal((await db.query('select * from public.oj_outreach_dm_log')).rows.length, 0);
    await assert.rejects(() => dm(null));
  });

  await t.test('direct table writes are refused', async () => {
    await as(oscar);
    await assert.rejects(() => db.exec(`insert into public.oj_outreach_dm_log(organization_id,actor_id,channel,work_day) values ('${org}','${oscar}','other',current_date)`));
    await assert.rejects(() => db.exec(`update public.oj_outreach_dm_log set undone_at=now()`));
    await assert.rejects(() => db.exec(`delete from public.oj_outreach_dm_log`));
    await assert.rejects(() => db.exec(`insert into public.oj_growth_settings(organization_id,dm_daily_goal) values ('${org}',1)`));
  });

  await t.test('undo is for the author, for 15 minutes, and restores status only if nobody moved it', async () => {
    await as(oscar);
    const other = await db.query<{ id: string }>(`select id from public.oj_outreach_dm_log where prospect_id='${p2}'`);
    await assert.rejects(() => db.query('select public.oj_undo_dm($1,$2)', [org, other.rows[0].id]));
    await as(jacob);
    const undone = await db.query<{ r: { today: number } }>('select public.oj_undo_dm($1,$2) r', [org, other.rows[0].id]);
    assert.equal(undone.rows[0].r.today, 3);
    assert.equal(await status(p2), 'Emailed');
    await assert.rejects(() => db.query('select public.oj_undo_dm($1,$2)', [org, other.rows[0].id]));
    // The same prospect can be counted again after an undo.
    assert.equal((await dm(p2, 'facebook')).rows[0].r.today, 4);

    await as(oscar);
    const mine = await db.query<{ id: string }>(`select id from public.oj_outreach_dm_log where prospect_id='${p1}'`);
    await db.exec('reset role');
    await db.exec(`update public.oj_outreach_dm_log set created_at = now() - interval '16 minutes' where prospect_id='${p1}'`);
    await as(oscar);
    await assert.rejects(() => db.query('select public.oj_undo_dm($1,$2)', [org, mine.rows[0].id]));
  });

  await t.test('undo leaves a prospect alone when it moved on since', async () => {
    await as(oscar);
    const [{ id }] = (await db.query<{ id: string }>(`select id from public.oj_outreach_dm_log where prospect_id='${p2}' and undone_at is null`)).rows;
    await db.exec('reset role');
    await db.exec(`update public.oj_outreach_prospects set outreach_status='Replied' where id='${p2}'`);
    await as(jacob);
    await db.query('select public.oj_undo_dm($1,$2)', [org, id]);
    assert.equal(await status(p2), 'Replied');
  });

  await t.test('the shared goal is changeable by partners only and stays within 1 to 50', async () => {
    await as(oscar);
    assert.equal((await db.query<{ g: number }>('select public.oj_set_dm_goal($1,$2) g', [org, 12])).rows[0].g, 12);
    await assert.rejects(() => db.query('select public.oj_set_dm_goal($1,$2)', [org, 0]));
    await assert.rejects(() => db.query('select public.oj_set_dm_goal($1,$2)', [org, 51]));
    await as(jacob);
    assert.equal((await db.query<{ dm_daily_goal: number }>('select dm_daily_goal from public.oj_growth_settings')).rows[0].dm_daily_goal, 12);
    await as(viewer);
    await assert.rejects(() => db.query('select public.oj_set_dm_goal($1,$2)', [org, 5]));
    await as(outsider);
    await assert.rejects(() => db.query('select public.oj_set_dm_goal($1,$2)', [org, 5]));
  });
});

test('email engine tables: partners read and flip the switch; only the server writes events', async t => {
  const { db, as, asService } = await database();
  const event = (kind: string, key: string, prospect = p1) =>
    db.query('insert into public.oj_email_events(organization_id,prospect_id,kind,dedupe_key) values ($1,$2,$3,$4)', [org, prospect, kind, key]);

  await t.test('the server writes state and events; a repeated key is refused', async () => {
    await asService();
    await db.exec(`insert into public.oj_email_engine_state(organization_id,state) values ('${org}','idle')`);
    await event('reserved', 'send:1');
    await event('sent', 'sent:1');
    await assert.rejects(() => event('sent', 'sent:1'));
    await assert.rejects(() => event('smoke', 'x'));
    await db.exec(`update public.oj_email_engine_state set state='sending', last_heartbeat_at=now()`);
  });

  await t.test('partners read events and state; viewers and outsiders do not', async () => {
    await as(oscar);
    assert.equal((await db.query('select * from public.oj_email_events')).rows.length, 2);
    assert.equal((await db.query<{ state: string }>('select * from public.oj_email_engine_state')).rows[0].state, 'sending');
    await as(jacob);
    assert.equal((await db.query('select * from public.oj_email_events')).rows.length, 2);
    await as(viewer);
    assert.equal((await db.query('select * from public.oj_email_events')).rows.length, 0);
    assert.equal((await db.query('select * from public.oj_email_engine_state')).rows.length, 0);
    await as(outsider);
    assert.equal((await db.query('select * from public.oj_email_events')).rows.length, 0);
  });

  await t.test('nobody signed in as a member can write events or state directly', async () => {
    await as(oscar);
    await assert.rejects(() => event('sent', 'forged'));
    await assert.rejects(() => db.exec(`update public.oj_email_engine_state set state='idle'`));
    await assert.rejects(() => db.exec(`delete from public.oj_email_events`));
    await assert.rejects(() => db.exec(`insert into public.oj_email_engine_settings(organization_id) values ('${org}')`));
  });

  await t.test('the switch, cap and niche change through the function only, within limits', async () => {
    const set = (enabled: boolean | null, cap: number, niche: string | null, tenant = org) =>
      db.query<{ r: { enabled: boolean; daily_cap_max: number; niche_filter: string | null } }>('select public.oj_set_email_engine($1,$2,$3,$4) r', [tenant, enabled, cap, niche]);
    await as(oscar);
    const off = await set(false, 25, '  pressure washing ');
    assert.deepEqual(off.rows[0].r, { enabled: false, daily_cap_max: 25, niche_filter: 'pressure washing' });
    await set(true, 30, '   ');
    assert.equal((await db.query<{ niche_filter: string | null }>('select niche_filter from public.oj_email_engine_settings')).rows[0].niche_filter, null);
    await assert.rejects(() => set(true, 41, null));
    await assert.rejects(() => set(true, 0, null));
    await assert.rejects(() => set(null, 10, null));
    await as(viewer);
    await assert.rejects(() => set(false, 10, null));
    await as(outsider);
    await assert.rejects(() => set(false, 10, null));
    await asService();
    assert.equal((await db.query<{ enabled: boolean }>('select enabled from public.oj_email_engine_settings')).rows[0].enabled, true);
  });
});
