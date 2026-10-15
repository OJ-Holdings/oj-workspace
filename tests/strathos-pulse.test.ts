import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

type Pulse = {
  version: number; organization: string;
  members: Array<{ name: string; isYou: boolean; state: string; work: { note: string } | null }>;
  finance: Array<{ amount: number; kind: string; category: string; note?: string }>;
  leads: Array<{ venture: string; stage: string; count: number }>;
  tasks: { open: number; dueSoon: Array<{ title: string }> };
};

async function setup(withPresence: boolean) {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
  const oscar = '00000000-0000-4000-8000-000000000011', jacob = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${oscar}'),('${jacob}'),('${stranger}');`);
  for (const file of ['workspace', 'dashboard']) await db.exec(await readFile(new URL(`../supabase/schemas/${file}.sql`, import.meta.url), 'utf8'));
  // presence.sql is not on main yet; these two tables carry only the columns oj_pulse reads from it.
  if (withPresence) await db.exec(`create table public.oj_presence_sessions(organization_id uuid not null, user_id uuid not null, session_id uuid not null, state text not null, seen_at timestamptz not null default clock_timestamp(), primary key(organization_id,user_id,session_id));
    create table public.oj_current_work(organization_id uuid not null, user_id uuid not null default auth.uid(), note text not null default '', updated_at timestamptz not null default clock_timestamp(), primary key(organization_id,user_id));
    grant insert on public.oj_presence_sessions, public.oj_current_work to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/schemas/strathos-pulse.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${org}','${oscar}','owner','Oscar'),('${org}','${jacob}','member','Jacob'),('${other}','${stranger}','member','Stranger');`);
  const as = async (id: string, role = 'authenticated') => { await db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`); };
  return { db, org, other, oscar, jacob, stranger, as };
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

test('pulse feed: token-gated summary of money, leads, tasks and presence', async t => {
  const { db, org, oscar, jacob, stranger, as } = await setup(true);
  const token = 'c'.repeat(64);
  await as(jacob);
  await assert.rejects(() => db.exec(`select public.oj_set_pulse_feed('${org}','${digest('9'.repeat(64))}')`), /owner required/i);
  await as(oscar); await db.exec(`select public.oj_set_pulse_feed('${org}','${digest(token)}')`);
  await db.exec(`insert into public.oj_finance_entries(organization_id,venture,kind,amount,occurred_on,category,note) values
    ('${org}','exterior','revenue',400,current_date,'House wash','Private: customer owes more'),
    ('${org}','exterior','cost',60,current_date - 2,'Chemicals',''),
    ('${org}','exterior','revenue',50,current_date - 400,'Too old','')`);
  await db.exec(`insert into public.oj_leads(organization_id,venture,name,contact,stage) values
    ('${org}','exterior','Mrs Henderson','555-0100','New'),('${org}','exterior','Mr Gray','555-0101','Won')`);
  await db.exec(`insert into public.oj_cards(organization_id,title,description,business,stage,due_date) values
    ('${org}','Send quote','Private details','exterior','Ready', current_date + 1),
    ('${org}','Finished thing','x','exterior','Done', current_date + 1),
    ('${org}','No date','x','solutions','Backlog', null)`);
  await db.exec(`insert into public.oj_presence_sessions(organization_id,user_id,session_id,state) values ('${org}','${oscar}','00000000-0000-4000-8000-000000000031','online')`);
  await as(jacob);
  await db.exec(`insert into public.oj_presence_sessions(organization_id,user_id,session_id,state) values ('${org}','${jacob}','00000000-0000-4000-8000-000000000032','online');
    insert into public.oj_current_work(organization_id,note) values ('${org}','Quoting the Hendersons')`);

  await as('', 'anon');
  const get = async (tok: string) => (await db.query<{ p: Pulse | null }>(`select public.oj_pulse('${tok}') as p`)).rows[0].p;

  await t.test('returns the documented shape for a valid token', async () => {
    const p = await get(token);
    assert.ok(p);
    assert.equal(p.version, 1);
    assert.equal(p.organization, 'OJ');
    assert.equal(p.finance.length, 2, 'the 400-day-old entry is left out');
    assert.equal(p.leads.length, 1);
    assert.deepEqual(p.leads[0], { venture: 'exterior', stage: 'New', count: 1 });
    assert.equal(p.tasks.open, 2);
    assert.deepEqual(p.tasks.dueSoon.map(d => d.title), ['Send quote']);
  });
  await t.test('presence: members report state and the status they chose to write', async () => {
    const p = (await get(token))!;
    const jacobRow = p.members.find(m => m.name === 'Jacob')!;
    assert.equal(jacobRow.state, 'online');
    assert.equal(jacobRow.isYou, false);
    assert.equal(jacobRow.work?.note, 'Quoting the Hendersons');
    assert.equal(p.members.find(m => m.name === 'Oscar')!.isYou, true);
  });
  await t.test('private fields never leave: notes, lead names, contacts, descriptions', async () => {
    const text = JSON.stringify(await get(token));
    for (const secret of ['customer owes more', 'Henderson\'s', 'Mrs Henderson', '555-0100', 'Private details']) assert.equal(text.includes(secret), false, secret);
  });
  await t.test('the calendar link does not open the summary', async () => {
    await as(oscar);
    await db.exec(`select public.oj_set_calendar_feed('${org}','${digest('1'.repeat(64))}')`);
    await as('', 'anon');
    assert.equal(await get('1'.repeat(64)), null);
  });
  await t.test('making a new link cancels the old one', async () => {
    await as(oscar);
    await db.exec(`select public.oj_set_pulse_feed('${org}','${digest('2'.repeat(64))}')`);
    await as('', 'anon');
    assert.equal(await get(token), null);
    assert.ok(await get('2'.repeat(64)));
    await as(oscar);
    await db.exec(`select public.oj_set_pulse_feed('${org}','${digest(token)}')`);
    await as('', 'anon');
  });
  await t.test('unknown, malformed and null tokens return nothing', async () => {
    assert.equal(await get('d'.repeat(64)), null);
    assert.equal(await get('not-a-token'), null);
    assert.equal((await db.query<{ p: unknown }>('select public.oj_pulse(null) as p')).rows[0].p, null);
  });
  await t.test('a stranger organisation never sees this workspace, and the link dies with membership', async () => {
    await as(stranger);
    await assert.rejects(() => db.exec(`select public.oj_set_pulse_feed('${org}','${digest('e'.repeat(64))}')`));
    await db.exec(`reset role; update public.oj_memberships set role='member' where user_id='${oscar}'`);
    await as('', 'anon');
    assert.equal(await get(token), null, 'no longer an owner');
    await db.exec(`reset role; update public.oj_memberships set role='owner' where user_id='${oscar}'`);
    await as('', 'anon');
    assert.ok(await get(token));
    await db.exec(`reset role; delete from public.oj_memberships where user_id='${oscar}'`);
    await as('', 'anon');
    assert.equal(await get(token), null);
  });
  await t.test('the link table itself stays unreadable', async () => {
    await as('', 'anon');
    await assert.rejects(() => db.query('select * from oj_private.calendar_feeds'));
  });
  await db.close();
});

test('pulse feed works before presence.sql is applied: members report offline', async () => {
  const { db, org, oscar, as } = await setup(false);
  const token = 'f'.repeat(64);
  await as(oscar); await db.exec(`select public.oj_set_pulse_feed('${org}','${digest(token)}')`);
  await as('', 'anon');
  const p = (await db.query<{ p: Pulse }>(`select public.oj_pulse('${token}') as p`)).rows[0].p;
  assert.deepEqual(p.members.map(m => m.state), ['offline', 'offline']);
  await db.close();
});
