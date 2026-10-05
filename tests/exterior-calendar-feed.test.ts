import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createLockedLegacyTables } from './exterior-read.test';
import { toICS } from '../src/lib/dashboard';

const schema = async (name: string) => readFile(new URL(`../supabase/schemas/${name}`, import.meta.url), 'utf8');

test('the calendar link includes Exterior Care jobs for owners and members, at their booked times', async t => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001';
  const owner = '00000000-0000-4000-8000-000000000011';
  const viewer = '00000000-0000-4000-8000-000000000013';
  await db.exec(`create role authenticated; create role anon;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}');`);
  await db.exec(await schema('workspace.sql'));
  await db.exec(await schema('dashboard.sql'));
  await createLockedLegacyTables(db);
  // The live columns the feed reads.
  await db.exec(`alter table public.leads add column name varchar, add column phone text, add column address text, add column service_requested varchar, add column quote_amount numeric;
    alter table public.bookings add column lead_id uuid, add column status varchar not null default 'confirmed';
    delete from public.bookings; delete from public.leads;`);
  await db.exec(await schema('exterior-hourly-slots.sql'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','Viewer');`);
  await db.exec(await schema('exterior-read.sql'));
  await db.exec(await schema('exterior-calendar-feed.sql'));

  const lead = '00000000-0000-4000-8000-0000000000a1';
  await db.exec(`insert into public.leads(id,name,phone,address,service_requested,quote_amount) values ('${lead}','Kevin','(815) 382-0471','21 W Margaret Ter','House washing',550);
    insert into public.bookings(lead_id,date,time_block,status) values
      ('${lead}', current_date + 1, '9-12', 'confirmed'),
      ('${lead}', current_date + 2, '4:30-9', 'pending_approval'),
      ('${lead}', current_date + 3, '12-3', 'denied'),
      (null, current_date + 4, '12-3', 'confirmed'),
      ('${lead}', current_date - 90, '9-12', 'confirmed');`);
  const as = async (id: string, role = 'authenticated') => { await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role ${role};`); };
  const link = async (who: string) => {
    const token = createHash('sha256').update(who).digest('hex');
    await as(who);
    await db.exec(`select public.oj_set_calendar_feed('${org}','${createHash('sha256').update(token).digest('hex')}')`);
    return token;
  };
  type Row = { title: string; starts_at: Date; ends_at: Date | null; all_day: boolean; location: string; notes: string; venture: string };
  const read = async (token: string) => { await as('', 'anon'); return (await db.query<Row>(`select * from public.oj_calendar_feed('${token}') order by starts_at`)).rows; };
  const chicago = (d: Date) => d.toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });

  await t.test("an owner's link has upcoming jobs, not denied or old ones, at Kenosha times", async () => {
    const rows = await read(await link(owner));
    assert.equal(rows.length, 3);
    const [first, second, third] = rows;
    assert.equal(first.title, 'Kevin / House washing');
    assert.equal(first.venture, 'exterior');
    assert.equal(first.location, '21 W Margaret Ter');
    assert.equal(first.notes, 'Exterior Care job\nQuote $550\n(815) 382-0471');
    assert.equal(first.all_day, false);
    assert.equal(chicago(first.starts_at), '9:00 AM');
    assert.equal(chicago(first.ends_at!), '12:00 PM');
    assert.equal(chicago(second.starts_at), '4:30 PM');
    assert.equal(chicago(second.ends_at!), '9:00 PM');
    assert.match(second.notes, /Waiting for approval$/);
    assert.equal(third.title, 'Customer');
    assert.equal(third.notes, 'Exterior Care job');
  });

  await t.test('the jobs make a valid calendar file', () => {
    const ics = toICS([{ id: 'x', title: 'Kevin / House washing', starts_at: '2026-10-06T14:00:00Z', ends_at: '2026-10-06T17:00:00Z', all_day: false, location: '21 W Margaret Ter', notes: 'Exterior Care job\nQuote $550', venture: 'exterior' }], new Date('2026-10-05T00:00:00Z'));
    assert.match(ics, /DTSTART:20261006T140000Z\r\nDTEND:20261006T170000Z\r\n/);
    assert.match(ics, /DESCRIPTION:Exterior Care job\\nQuote \$550\r\n/);
  });

  await t.test("a viewer's link has no customer jobs", async () => {
    assert.equal((await read(await link(viewer))).length, 0);
  });

  await t.test('unknown and malformed tokens still return nothing', async () => {
    assert.equal((await read('c'.repeat(64))).length, 0);
    assert.equal((await read('nope')).length, 0);
  });
  await db.close();
});
