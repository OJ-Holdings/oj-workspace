import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');
    create table public.leads(id uuid primary key, name text, phone text, address text, created_at timestamptz not null default now());`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');`);
  // Seven jobs: Fay twice by phone and once by name and address, two different people on the same placeholder number, and one unnamed customer at two addresses.
  // Mirrors what exterior-read.sql records in production: the one workspace that owns the legacy leads.
  await db.exec(`create table oj_private.legacy_owner(organization_id uuid primary key references public.oj_organizations(id)); insert into oj_private.legacy_owner values ('${org}');`);
  await db.exec(`insert into public.leads(id,name,phone,address,created_at) values
    ('${id(1)}','Fay Akindes','(414) 555-0101','1 Main St','2026-06-01'),
    ('${id(2)}','Fay A.','+1 414 555 0101','1 Main St','2026-08-01'),
    ('${id(3)}','Fay Akindes',null,'1  MAIN st','2026-09-01'),
    ('${id(4)}','Bill','NP_123','2 Oak Ave','2026-06-02'),
    ('${id(5)}','Tom','NP_123','3 Elm Rd','2026-06-03'),
    ('${id(6)}',null,'262-555-0199','9 Oak Ave','2026-06-04'),
    ('${id(7)}',null,'262.555.0199','10 Pine Rd','2026-06-05');`);
  await db.exec(await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-customers.sql', import.meta.url), 'utf8'));
  return db;
}
const as = async (db: PGlite, uid: string) => { await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`); };
const count = async (db: PGlite, table: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;

test('backfill makes one customer per person: same phone, or same name at the same address; placeholder numbers never match', async () => {
  const db = await setup();
  await as(db, owner);
  const r = (await db.query<{ r: { customers: number; properties: number; linked: number } }>(`select public.oj_backfill_customers('${org}') as r`)).rows[0].r;
  assert.deepEqual(r, { customers: 4, properties: 5, linked: 7 });
  const fay = (await db.query<{ n: number }>(`select count(*)::int as n from oj_lead_links k join oj_customers c on c.id = k.customer_id where c.name = 'Fay Akindes'`)).rows[0].n;
  assert.equal(fay, 3);
  assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from oj_customers where name = 'Unnamed customer'`)).rows[0].n, 1);
  assert.equal((await db.query<{ k: string }>(`select phone_key as k from oj_customers where name = 'Fay Akindes'`)).rows[0].k, '4145550101');
});

test('running it again links only new leads, and a new lead with a known phone joins that customer', async () => {
  const db = await setup();
  await as(db, owner);
  await db.query(`select public.oj_backfill_customers('${org}')`);
  const again = (await db.query<{ r: { customers: number; linked: number } }>(`select public.oj_backfill_customers('${org}') as r`)).rows[0].r;
  assert.deepEqual([again.customers, again.linked], [0, 0]);
  await db.exec('reset role');
  await db.exec(`insert into public.leads(id,name,phone,address) values ('${id(8)}','Fay Again','414-555-0101','55 New Rd')`);
  await as(db, owner);
  const next = (await db.query<{ r: { customers: number; properties: number; linked: number } }>(`select public.oj_backfill_customers('${org}') as r`)).rows[0].r;
  assert.deepEqual(next, { customers: 0, properties: 1, linked: 1 });
  assert.equal(await count(db, 'oj_customers'), 4);
});

test('link a job elsewhere, merge two customers, and refuse a property that is not the customer\'s', async () => {
  const db = await setup();
  await as(db, owner);
  await db.query(`select public.oj_backfill_customers('${org}')`);
  const bill = (await db.query<{ id: string }>(`select id from oj_customers where name = 'Bill'`)).rows[0].id;
  const tom = (await db.query<{ id: string; pid: string }>(`select c.id, p.id as pid from oj_customers c join oj_properties p on p.customer_id = c.id where c.name = 'Tom'`)).rows[0];
  await assert.rejects(() => db.query(`select public.oj_link_lead('${org}', '${id(4)}', '${bill}', '${tom.pid}')`), /does not belong/);
  await db.query(`select public.oj_link_lead('${org}', '${id(4)}', '${tom.id}', '${tom.pid}')`);
  assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from oj_lead_links where customer_id = '${tom.id}'`)).rows[0].n, 2);
  await db.query(`select public.oj_merge_customers('${org}', '${tom.id}', '${bill}')`);
  assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from oj_customers where id = '${bill}'`)).rows[0].n, 0);
  assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from oj_properties where customer_id = '${tom.id}'`)).rows[0].n, 2);
  await assert.rejects(() => db.query(`select public.oj_merge_customers('${org}', '${tom.id}', '${tom.id}')`), /two different/);
});

test('members can edit notes but not ownership or keys; nobody can delete; viewers and other workspaces see and do nothing', async () => {
  const db = await setup();
  await as(db, owner);
  await db.query(`select public.oj_backfill_customers('${org}')`);
  await db.exec(`update oj_properties set access_notes = 'Gate code 1234, dog in yard', water_notes = 'Spigot on the north wall' where address = '3 Elm Rd'`);
  assert.equal((await db.query<{ a: string }>(`select access_notes as a from oj_properties where address = '3 Elm Rd'`)).rows[0].a, 'Gate code 1234, dog in yard');
  await assert.rejects(() => db.exec(`update oj_properties set organization_id = '${other}'`));
  await assert.rejects(() => db.exec(`update oj_customers set phone_key = 'x'`));
  await assert.rejects(() => db.exec('delete from oj_customers'));
  await assert.rejects(() => db.exec(`insert into oj_lead_links(lead_id,organization_id,customer_id) select '${id(99)}', organization_id, id from oj_customers limit 1`));
  await as(db, viewer);
  assert.equal(await count(db, 'oj_customers'), 0);
  assert.equal(await count(db, 'oj_properties'), 0);
  assert.equal(await count(db, 'oj_lead_links'), 0);
  await assert.rejects(() => db.query(`select public.oj_backfill_customers('${org}')`), /member access/);
  await as(db, stranger);
  assert.equal(await count(db, 'oj_customers'), 0);
  await assert.rejects(() => db.query(`select public.oj_backfill_customers('${org}')`), /member access/);
});

test('the script is one transaction and refuses a second run', async () => {
  const db = await setup();
  await db.exec('reset role');
  const script = await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-customers.sql', import.meta.url), 'utf8');
  await assert.rejects(() => db.exec(script), /already exists/);
});

test('only the workspace that owns the old leads can build customers from them or link them', async () => {
  const db = await setup();
  // A second workspace has its own owner and tries to pull the first company's leads into its own books.
  await as(db, stranger);
  await assert.rejects(() => db.query(`select public.oj_backfill_customers('${other}')`), /owns the Exterior Care records/);
  await assert.rejects(() => db.query(`select public.oj_link_lead('${other}', '${id(1)}', '${id(1)}', null)`), /owns the Exterior Care records/);
  await db.exec('reset role');
  assert.equal(await count(db, 'oj_customers'), 0);
  assert.equal(await count(db, 'oj_lead_links'), 0);
  // The owning workspace cannot link a job that does not exist.
  await as(db, owner);
  await db.query(`select public.oj_backfill_customers('${org}')`);
  const c = (await db.query<{ id: string }>('select id from oj_customers limit 1')).rows[0].id;
  await assert.rejects(() => db.query(`select public.oj_link_lead('${org}', '${id(99)}', '${c}', null)`), /does not exist/);
});
