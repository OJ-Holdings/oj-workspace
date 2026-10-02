import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('One-time owner setup grants access only to the verified administrator-assigned email', async t => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001';
  const owner = '00000000-0000-4000-8000-000000000011';
  const other = '00000000-0000-4000-8000-000000000012';
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values('${owner}','owner@example.test',null),('${other}','other@example.test',now());`);
  for (const schema of ['workspace','owner-setup']) await db.exec(await readFile(new URL(`../supabase/schemas/${schema}.sql`, import.meta.url),'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values('${org}','OJ'); insert into oj_private.owner_setup(organization_id,email) values('${org}','owner@example.test');`);
  const as = async (id:string,role='authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
  const claim = () => db.query(`select public.oj_claim_owner('Owner')`);
  await t.test('anonymous callers cannot claim or inspect private enrollment', async () => {
    await as('','anon'); await assert.rejects(claim); await assert.rejects(()=>db.query('select * from oj_private.owner_setup'));
  });
  await t.test('verified unrelated accounts cannot claim or change the expected email', async () => {
    await as(other); await assert.rejects(claim); await assert.rejects(()=>db.exec(`update oj_private.owner_setup set email='other@example.test'`));
  });
  await t.test('matching unverified account cannot claim owner role', async () => { await as(owner); await assert.rejects(claim); });
  await t.test('matching auto-confirmed account cannot claim without administrator approval', async () => {
    await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${owner}'`); await as(owner); await assert.rejects(claim);
    await assert.rejects(()=>db.exec(`update oj_private.owner_setup set approved_user_id='${owner}'`));
  });
  await t.test('administrator-approved matching account can claim exactly once', async () => {
    await db.exec(`reset role; update oj_private.owner_setup set approved_user_id='${owner}'`); await as(owner); await claim();
    assert.equal((await db.query<{role:string}>('select role from public.oj_memberships')).rows[0].role,'owner'); await assert.rejects(claim);
  });
  await t.test('consumed enrollment cannot be reopened through member privileges', async () => {
    await assert.rejects(()=>db.exec('update oj_private.owner_setup set claimed_at=null'));
    const {rows} = await db.query<{pending:boolean}>(`select public.oj_owner_setup_pending('owner@example.test') as pending`); assert.equal(rows[0].pending,false);
  });
  await db.close();
});
