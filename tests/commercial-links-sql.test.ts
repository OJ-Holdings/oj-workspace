import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
const account = '00000000-0000-4000-8000-000000000021', foreign = '00000000-0000-4000-8000-000000000022';
const proposal = '00000000-0000-4000-8000-000000000031', invoice = '00000000-0000-4000-8000-000000000032', doc = '00000000-0000-4000-8000-000000000033';
const sql = (path: string) => readFile(new URL('../' + path, import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');`);
  await db.exec(await sql('supabase/schemas/workspace.sql'));
  await db.exec(await sql('supabase/schemas/dashboard.sql'));
  await db.exec(await sql('docs/production-sql/20261026173732_oj_commercial_accounts_u2.sql'));
  await db.exec(await sql('docs/db-change-proposals/RUN-ME-2026-10-28-proposals.sql'));
  await db.exec(await sql('docs/db-change-proposals/RUN-ME-money-core.sql'));
  await db.exec(await sql('docs/db-change-proposals/RUN-ME-2026-11-05-commercial-links.sql'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');
    insert into oj_commercial_accounts(organization_id,id,name,created_by,updated_by) values ('${org}','${account}','Acme Roller','${owner}','${owner}'),('${other}','${foreign}','Elsewhere','${stranger}','${stranger}');
    insert into oj_proposals(id,organization_id,number,division,customer_name,valid_until,subtotal_cents,total_cents,created_by) values ('${proposal}','${org}','P-1','exterior','Acme Roller','2030-01-01',50000,50000,'${owner}');
    insert into oj_invoices(id,organization_id,number,division,customer_name,issue_date,due_date,subtotal_cents,total_cents,created_by) values ('${invoice}','${org}','I-1','exterior','Acme Roller','2026-11-01','2026-11-30',50000,50000,'${owner}');
    insert into oj_documents(id,organization_id,name,storage_path,size_bytes,uploaded_by) values ('${doc}','${org}','Proposal.pdf','${org}/x/Proposal.pdf',10,'${owner}');`);
  return db;
}
const as = (db: PGlite, uid: string) => db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`);
const link = (db: PGlite, kind: string, id: string, acct: string | null, tenant = org) =>
  db.query('select public.oj_commercial_link_record($1,$2,$3,$4)', [tenant, kind, id, acct]);
const linked = async (db: PGlite) => (await db.query<{ n: number }>(`select (select count(*) from oj_proposals where commercial_account_id='${account}')
  + (select count(*) from oj_invoices where commercial_account_id='${account}') + (select count(*) from oj_documents where commercial_account_id='${account}') as n`)).rows[0].n;

test('an owner links and unlinks a proposal, an invoice and a document to their company; invoice money stays locked', async () => {
  const db = await setup();
  await as(db, owner);
  for (const [kind, id] of [['proposal', proposal], ['invoice', invoice], ['document', doc]]) await link(db, kind, id, account);
  assert.equal(Number(await linked(db)), 3);
  await link(db, 'invoice', invoice, null);
  assert.equal(Number(await linked(db)), 2);
  await db.exec('reset role');
  await assert.rejects(() => db.exec(`update oj_invoices set total_cents = 1, subtotal_cents = 1 where id = '${invoice}'`));
  await assert.rejects(() => db.exec(`update oj_invoices set commercial_account_id = '${account}' where id = '${invoice}'`));
});

test('a viewer and an outsider cannot link, and nobody links to another workspace\'s company or a missing record', async () => {
  const db = await setup();
  await as(db, viewer);
  await assert.rejects(() => link(db, 'proposal', proposal, account), /membership/);
  await as(db, stranger);
  await assert.rejects(() => link(db, 'proposal', proposal, account), /membership/);
  await as(db, owner);
  await assert.rejects(() => link(db, 'proposal', proposal, foreign), /foreign key|violates/);
  await assert.rejects(() => link(db, 'proposal', foreign, account), /not found/);
  await assert.rejects(() => link(db, 'lead', proposal, account), /kind/);
  await assert.rejects(() => db.exec(`update oj_documents set commercial_account_id = '${account}' where id = '${doc}'`));
  assert.equal(Number(await linked(db)), 0);
});
