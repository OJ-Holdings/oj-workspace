import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');`);
  await db.exec(await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-proposals.sql', import.meta.url), 'utf8'));
  return db;
}
const as = async (db: PGlite, uid: string) => { await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`); };
const soon = () => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
const lines = (extra = '') => `'[{"description":"Facility A","quantity":1,"unit_price_cents":95000},{"description":"Facility B","quantity":1,"unit_price_cents":195000},{"description":"Semiannual maintenance","quantity":1,"unit_price_cents":235000,"optional":true}${extra}]'::jsonb`;
const create = (org_: string, discount = 15000, linesSql = lines()) => `select public.oj_create_proposal('${org_}', '{"name":"American Roller","address":"Union Grove, WI"}'::jsonb, 'exterior', '${soon()}', 'Net 30', 'Terms', 'Exclusions', '', ${discount}, ${linesSql}) as id`;

test('a proposal is numbered per year, totals exclude optional lines, and the discount comes off the subtotal', async () => {
  const db = await setup();
  await as(db, owner);
  const a = (await db.query<{ id: string }>(create(org))).rows[0].id;
  await db.query(create(org));
  const rows = (await db.query<{ number: string; subtotal_cents: string; discount_cents: string; total_cents: string; status: string }>('select number, subtotal_cents, discount_cents, total_cents, status from oj_proposals order by number')).rows;
  assert.deepEqual(rows.map(r => r.number.slice(-4)), ['0001', '0002']);
  assert.deepEqual([rows[0].subtotal_cents, rows[0].discount_cents, rows[0].total_cents, rows[0].status], [290000, 15000, 275000, 'draft']);
  assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from oj_proposal_lines where proposal_id = '${a}'`)).rows[0].n, 3);
});

test('bad input is refused: past validity, no payable line, a discount that eats the subtotal, negative price', async () => {
  const db = await setup();
  await as(db, owner);
  await assert.rejects(() => db.query(`select public.oj_create_proposal('${org}', '{"name":"X"}'::jsonb, 'exterior', '2020-01-01', '', '', '', '', 0, ${lines()})`), /past/);
  await assert.rejects(() => db.query(create(org, 0, `'[{"description":"Only optional","quantity":1,"unit_price_cents":5000,"optional":true}]'::jsonb`)), /not optional/);
  await assert.rejects(() => db.query(create(org, 290000)), /less than the subtotal/);
  await assert.rejects(() => db.query(create(org, 0, `'[{"description":"Bad","quantity":1,"unit_price_cents":-5}]'::jsonb`)), /positive/);
});

test('status moves draft to sent to a decision once; a decided proposal is final; only drafts can be deleted', async () => {
  const db = await setup();
  await as(db, owner);
  const id = (await db.query<{ id: string }>(create(org))).rows[0].id;
  await assert.rejects(() => db.query(`select public.oj_set_proposal_status('${org}', '${id}', 'accepted', current_date, '')`), /draft proposal cannot be marked accepted/);
  await db.query(`select public.oj_set_proposal_status('${org}', '${id}', 'sent', current_date, '')`);
  await assert.rejects(() => db.query(`select public.oj_delete_draft_proposal('${org}', '${id}')`), /Only a draft/);
  await db.query(`select public.oj_set_proposal_status('${org}', '${id}', 'declined', current_date, 'went with another company')`);
  await assert.rejects(() => db.query(`select public.oj_set_proposal_status('${org}', '${id}', 'accepted', current_date, '')`), /declined proposal cannot be marked accepted/);
  const r = (await db.query<{ status: string; decision_note: string }>(`select status, decision_note from oj_proposals where id = '${id}'`)).rows[0];
  assert.deepEqual([r.status, r.decision_note], ['declined', 'went with another company']);
  const draft = (await db.query<{ id: string }>(create(org))).rows[0].id;
  await db.query(`select public.oj_delete_draft_proposal('${org}', '${draft}')`);
  assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from oj_proposals where id = '${draft}'`)).rows[0].n, 0);
});

test('direct writes are refused, a viewer cannot read or create, and another workspace sees nothing', async () => {
  const db = await setup();
  await as(db, owner);
  const id = (await db.query<{ id: string }>(create(org))).rows[0].id;
  await assert.rejects(() => db.exec(`update oj_proposals set status = 'accepted' where id = '${id}'`));
  await assert.rejects(() => db.exec(`delete from oj_proposals where id = '${id}'`));
  await assert.rejects(() => db.exec(`update oj_proposal_lines set quantity = 9 where proposal_id = '${id}'`));
  await assert.rejects(() => db.exec(`insert into oj_proposals(organization_id,number,division,customer_name,valid_until,subtotal_cents,total_cents) values ('${org}','X','exterior','X','2030-01-01',1,1)`));
  await as(db, viewer);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_proposals')).rows[0].n, 0);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_proposal_lines')).rows[0].n, 0);
  await assert.rejects(() => db.query(create(org)), /member access/);
  await as(db, stranger);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_proposals')).rows[0].n, 0);
  await assert.rejects(() => db.query(create(org)), /member access/);
});

test('the script is one transaction and refuses a second run', async () => {
  const db = await setup();
  await db.exec('reset role');
  const script = await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-proposals.sql', import.meta.url), 'utf8');
  await assert.rejects(() => db.exec(script), /already exists/);
});
