import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('commercial company profiles are private, tenant-scoped, versioned and non-destructive',async t=>{
 const db=new PGlite();
 const org='00000000-0000-4000-8000-000000000001';
 const otherOrg='00000000-0000-4000-8000-000000000002';
 const owner='00000000-0000-4000-8000-000000000011';
 const member='00000000-0000-4000-8000-000000000012';
 const viewer='00000000-0000-4000-8000-000000000013';
 const outsider='00000000-0000-4000-8000-000000000014';
 const account='00000000-0000-4000-8000-000000000021';
 const person='00000000-0000-4000-8000-000000000022';
 const property='00000000-0000-4000-8000-000000000023';
 const command='00000000-0000-4000-8000-000000000031';
 const data={name:'Test facility group',industry:'Commercial',website:'',notes:'',
  contacts:[{id:person,fullName:'Accounts payable',role:'Billing',email:'',phone:''}],
  properties:[{id:property,name:'Service site',address:'',serviceNotes:'',frequency:'quarterly'}]};
 await db.exec(`create role authenticated; create role anon; create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth,public to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
  insert into auth.users values ('${owner}'),('${member}'),('${viewer}'),('${outsider}');`);
 await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql',import.meta.url),'utf8'));
 await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${otherOrg}','Other');
   insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${org}','${owner}','owner','Owner'),
    ('${org}','${member}','member','Member'),
    ('${org}','${viewer}','viewer','Viewer'),
    ('${otherOrg}','${outsider}','owner','Other owner');`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261026001000_oj_commercial_accounts.sql',import.meta.url),'utf8'));
 const as=(uid:string,role='authenticated')=>db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role ${role};`);
 const save=(commandId:string,expected:number,payload:unknown=data,tenant=org)=>db.query<{v:{
  ok:boolean;revision?:number;replayed?:boolean;conflict?:boolean;currentRevision?:number}}>(
  'select public.oj_commercial_account_save($1,$2,$3,$4,$5::jsonb) v',
  [tenant,account,expected,commandId,JSON.stringify(payload)]);
 const list=(tenant=org)=>db.query<{v:{accounts:Array<any>;hasMore:boolean}}>(
  'select public.oj_commercial_accounts_list($1,$2) v',[tenant,50]);
 const contactFlags=await db.query<{badId:boolean;badNameType:boolean;badNameLength:boolean;badRoleType:boolean;badEmailType:boolean;badPhoneType:boolean}>(`
  select (v->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' as "badId",
   jsonb_typeof(v->'fullName') is distinct from 'string' as "badNameType",
   length(btrim(v->>'fullName')) not between 1 and 120 as "badNameLength",
   jsonb_typeof(v->'role') is distinct from 'string' as "badRoleType",
   jsonb_typeof(v->'email') is distinct from 'string' as "badEmailType",
   jsonb_typeof(v->'phone') is distinct from 'string' as "badPhoneType"
  from jsonb_array_elements($1::jsonb->'contacts') v`,[JSON.stringify(data)]);
 assert.deepEqual(contactFlags.rows,[{badId:false,badNameType:false,badNameLength:false,badRoleType:false,badEmailType:false,badPhoneType:false}]);
 await t.test('owner creates and member reads 1 account with exact child profiles',async()=>{
  await as(owner);
  const result=await save(command,0);
  assert.equal(result.rows[0].v.revision,1);
  assert.equal((await save(command,0)).rows[0].v.replayed,true);
  await assert.rejects(()=>save(command,0,{...data,name:'Changed same command'}));
  await as(member);
  const page=(await list()).rows[0].v;
  assert.equal(page.accounts.length,1);
  assert.equal(page.accounts[0].name,data.name);
  assert.equal(page.accounts[0].contacts[0].fullName,'Accounts payable');
  assert.equal(page.accounts[0].properties[0].frequency,'quarterly');
  assert.equal(page.hasMore,false);
  await assert.rejects(()=>db.query('select * from public.oj_commercial_accounts'));
  await assert.rejects(()=>db.query('select * from oj_private.oj_commercial_account_commands'));
 });
 await t.test('optimistic revisions prevent stale overwrites and omitted children remain',async()=>{
  await as(member);
  const second=await save('00000000-0000-4000-8000-000000000032',1,
   {...data,notes:'Quarterly bid',contacts:[],properties:[]});
  assert.equal(second.rows[0].v.revision,2);
  const stale=await save('00000000-0000-4000-8000-000000000033',1,data);
  assert.equal(stale.rows[0].v.conflict,true);
  assert.equal(stale.rows[0].v.currentRevision,2);
  const page=(await list()).rows[0].v;
  assert.equal(page.accounts[0].revision,2);
  assert.equal(page.accounts[0].contacts.length,1);
  assert.equal(page.accounts[0].properties.length,1);
 });
 await t.test('direct RPC rejects malformed child data and duplicate IDs',async()=>{
  await as(owner);
  await assert.rejects(()=>save('00000000-0000-4000-8000-000000000034',2,
   {...data,contacts:[data.contacts[0],data.contacts[0]]}));
  await assert.rejects(()=>save('00000000-0000-4000-8000-000000000035',2,
   {...data,properties:[{...data.properties[0],frequency:'approved'}]}));
  await assert.rejects(()=>save('00000000-0000-4000-8000-000000000036',2,
   {...data,contacts:[{...data.contacts[0],fullName:''}]}));
  const page=(await list()).rows[0].v;
  assert.equal(page.accounts[0].revision,2);
  await db.exec('reset role');
  await assert.rejects(()=>db.query('delete from oj_private.oj_commercial_account_commands'));
 });
 await t.test('unauthorized viewers, other founders, anonymous and revoked members are denied',async()=>{
  for(const id of [viewer,outsider]){
   await as(id);
   await assert.rejects(()=>list());
   await assert.rejects(()=>save('00000000-0000-4000-8000-000000000037',2));
  }
  await db.exec('reset role; reset request.jwt.claim.sub; set role anon;');
  await assert.rejects(()=>list());
  await assert.rejects(()=>save('00000000-0000-4000-8000-000000000038',2));
  await db.exec(`reset role; delete from public.oj_memberships where organization_id='${org}' and user_id='${member}'`);
  await as(member);
  await assert.rejects(()=>list());
  await assert.rejects(()=>save('00000000-0000-4000-8000-000000000039',2));
 });
});
