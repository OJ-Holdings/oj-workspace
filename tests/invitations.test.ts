import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Invitations and membership administration enforce verified identity and least privilege', async t => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001';
  const otherOrg = '00000000-0000-4000-8000-000000000002';
  const owner = '00000000-0000-4000-8000-000000000011';
  const jacob = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  const outsider = '00000000-0000-4000-8000-000000000014';
  const unverified = '00000000-0000-4000-8000-000000000015';
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}','owner@example.test',now()),('${jacob}','jacob@example.test',now()),('${viewer}','viewer@example.test',now()),('${outsider}','other@example.test',now()),('${unverified}','unverified@example.test',null);`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/collaboration.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values('${org}','OJ'),('${otherOrg}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','Viewer');`);
  const as = async (id: string, role = 'authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
  const token = (n: number) => n.toString(16).padStart(64, '0');
  const digest = (n: number) => createHash('sha256').update(token(n)).digest('hex');
  const issue = async (n: number, email = 'jacob@example.test', role = 'member') => {
    await as(owner);
    return (await db.query<{id:string}>(`select public.oj_create_invitation($1,$2,$3,$4) as id`, [org,email,role,digest(n)])).rows[0].id;
  };
  const accept = async (n: number, name = 'Jacob') => db.query(`select public.oj_accept_invitation($1,$2)`, [token(n),name]);
  await t.test('private invitation storage and hashes are inaccessible to members', async () => {
    await as(owner); await assert.rejects(() => db.query('select * from oj_private.invitations'));
    await assert.rejects(() => db.exec(`insert into oj_private.invitations default values`));
  });
  await t.test('anonymous callers cannot call invitation or membership RPCs', async () => {
    await as('', 'anon');
    await assert.rejects(() => accept(1));
    await assert.rejects(() => db.query(`select public.oj_list_invitations($1)`, [org]));
  });
  await t.test('nonmembers and viewers cannot issue, list or administer invitations', async () => {
    for (const user of [outsider,viewer]) {
      await as(user);
      await assert.rejects(() => db.query(`select public.oj_create_invitation($1,$2,$3,$4)`, [org,'jacob@example.test','member',digest(1)]));
      await assert.rejects(() => db.query(`select * from public.oj_list_invitations($1)`, [org]));
      await assert.rejects(() => db.query(`select public.oj_manage_member($1,$2,$3)`, [org,owner,'remove']));
    }
    await as(owner); await assert.rejects(() => db.query(`select * from public.oj_list_invitations($1)`, [otherOrg]));
  });
  await t.test('owner invitations and null roles cannot bypass validation', async () => {
    await assert.rejects(() => issue(1,'jacob@example.test','owner'));
    await assert.rejects(() => db.query(`select public.oj_create_invitation($1,$2,null,$3)`, [org,'jacob@example.test',digest(1)]));
  });
  await t.test('wrong verified email and unverified email cannot accept', async () => {
    await issue(1); await as(outsider); await assert.rejects(() => accept(1));
    await issue(2,'unverified@example.test'); await as(unverified); await assert.rejects(() => accept(2,'Unverified'));
  });
  await t.test('anonymous preflight checks link plus email without exposing invitation data', async () => {
    await as('', 'anon');
    const check = async (value:string,email:string) => (await db.query<{valid:boolean}>(`select public.oj_validate_invitation($1,$2) as valid`,[value,email])).rows[0].valid;
    assert.equal(await check(token(1),'jacob@example.test'),true);
    assert.equal(await check(token(1),'other@example.test'),false);
    assert.equal(await check(token(99),'jacob@example.test'),false);
    assert.equal(await check('invalid','jacob@example.test'),false);
  });
  await t.test('verified invited account joins with exact granted role, and token cannot replay', async () => {
    await as(jacob); await accept(1);
    const row = (await db.query<{role:string}>(`select role from public.oj_memberships where user_id=$1`,[jacob])).rows[0];
    assert.equal(row.role,'member'); await assert.rejects(() => accept(1));
    await as(owner);
    const invites = (await db.query<Record<string,unknown>>(`select * from public.oj_list_invitations($1)`,[org])).rows;
    assert.ok(invites.some(i=>i.accepted_at)); assert.ok(invites.every(i=>!('token_hash' in i)));
  });
  await t.test('revoked invitations cannot be accepted', async () => {
    const id = await issue(3,'other@example.test');
    await db.query(`select public.oj_revoke_invitation($1,$2)`,[org,id]);
    await as(outsider); await assert.rejects(() => accept(3,'Other'));
  });
  await t.test('expired invitations cannot be accepted', async () => {
    const id = await issue(4,'other@example.test');
    await db.exec('reset role'); await db.query(`update oj_private.invitations set expires_at=now()-interval '1 minute' where id=$1`,[id]);
    await as(outsider); await assert.rejects(() => accept(4,'Other'));
  });
  await t.test('duplicate display name rolls back acceptance so invitation remains usable', async () => {
    await issue(5,'other@example.test'); await as(outsider);
    await assert.rejects(() => accept(5,'Oscar'));
    await accept(5,'Other');
  });
  await t.test('invitation cannot downgrade or elevate an existing member', async () => {
    await issue(6,'jacob@example.test','viewer'); await as(jacob); await accept(6);
    assert.equal((await db.query<{role:string}>(`select role from public.oj_memberships where user_id=$1`,[jacob])).rows[0].role,'member');
  });
  await t.test('owner accounts cannot be removed or demoted, and owner grants are forbidden', async () => {
    await as(owner);
    for (const role of ['viewer','remove','owner']) await assert.rejects(() => db.query(`select public.oj_manage_member($1,$2,$3)`,[org,owner,role]));
    await assert.rejects(() => db.query(`select public.oj_manage_member($1,$2,'owner')`,[org,jacob]));
  });
  await t.test('owner can restrict a member to viewer; same identity immediately loses writes', async () => {
    await as(owner); await db.query(`select public.oj_manage_member($1,$2,'viewer')`,[org,jacob]);
    await as(jacob);
    await assert.rejects(() => db.query(`insert into public.oj_cards(organization_id,title,business) values($1,'Viewer write','solutions')`,[org]));
  });
  await t.test('removal revokes memberships and pending links without changing private tenants', async () => {
    await issue(7,'jacob@example.test'); await as(owner);
    await db.query(`insert into public.oj_cards(organization_id,title,business,assignee) values($1,'Assigned before removal','solutions','Jacob')`,[org]);
    await db.query(`select public.oj_manage_member($1,$2,'remove')`,[org,jacob]);
    assert.equal((await db.query<{assignee:string}>(`select assignee from public.oj_cards where title='Assigned before removal'`)).rows[0].assignee,'');
    await as(jacob); assert.equal((await db.query('select * from public.oj_memberships')).rows.length,0);
    await assert.rejects(() => accept(7));
  });
  await t.test('invitation issuer must remain an owner', async () => {
    await issue(8,'jacob@example.test'); await db.exec(`reset role; update public.oj_memberships set role='member' where user_id='${owner}'`);
    await as(jacob); await assert.rejects(() => accept(8));
  });
  await db.close();
});
