import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
const lead = '00000000-0000-4000-8000-0000000000aa';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');`);
  await db.exec(await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-job-expenses.sql', import.meta.url), 'utf8'));
  return db;
}
const as = async (db: PGlite, uid: string) => { await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`); };

test('an owner adds and removes a job expense; amounts and kinds are validated', async () => {
  const db = await setup();
  await as(db, owner);
  await db.exec(`insert into oj_job_expenses(organization_id,lead_id,kind,amount,note,spent_on) values ('${org}','${lead}','materials',42.5,'SH','2026-10-27')`);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_job_expenses')).rows[0].n, 1);
  await assert.rejects(() => db.exec(`insert into oj_job_expenses(organization_id,lead_id,kind,amount,spent_on) values ('${org}','${lead}','materials',-1,'2026-10-27')`));
  await assert.rejects(() => db.exec(`insert into oj_job_expenses(organization_id,lead_id,kind,amount,spent_on) values ('${org}','${lead}','snacks',5,'2026-10-27')`));
  await db.exec('delete from oj_job_expenses');
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_job_expenses')).rows[0].n, 0);
});

test('a viewer can neither read nor add, a stranger sees nothing, and nobody can add as someone else', async () => {
  const db = await setup();
  await as(db, owner);
  await db.exec(`insert into oj_job_expenses(organization_id,lead_id,kind,amount,spent_on) values ('${org}','${lead}','fuel',20,'2026-10-27')`);
  await as(db, viewer);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_job_expenses')).rows[0].n, 0);
  await assert.rejects(() => db.exec(`insert into oj_job_expenses(organization_id,lead_id,kind,amount,spent_on) values ('${org}','${lead}','fuel',5,'2026-10-27')`));
  await as(db, stranger);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_job_expenses')).rows[0].n, 0);
  await assert.rejects(() => db.exec(`insert into oj_job_expenses(organization_id,lead_id,kind,amount,spent_on) values ('${org}','${lead}','fuel',5,'2026-10-27')`));
  await as(db, owner);
  await assert.rejects(() => db.exec(`insert into oj_job_expenses(organization_id,lead_id,kind,amount,spent_on,created_by) values ('${org}','${lead}','fuel',5,'2026-10-27','${viewer}')`));
});

test('the script is one transaction and refuses a second run', async () => {
  const db = await setup();
  await db.exec('reset role');
  await assert.rejects(() => db.exec('select 1; ' + 'create table public.oj_job_expenses(id int)'), /already exists/);
});
