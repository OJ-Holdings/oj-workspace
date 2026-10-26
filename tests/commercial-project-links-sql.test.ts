import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('U2B exact commercial project-company-property links: actor tenancy, revisions and replay',async t=>{
 const db=new PGlite();
 const org='00000000-0000-4000-8000-000000000001';
 const other='00000000-0000-4000-8000-000000000002';
 const owner='00000000-0000-4000-8000-000000000011';
 const member='00000000-0000-4000-8000-000000000012';
 const viewer='00000000-0000-4000-8000-000000000013';
 const outsider='00000000-0000-4000-8000-000000000014';
 const project='00000000-0000-4000-8000-000000000021';
 const account='00000000-0000-4000-8000-000000000022';
 const property='00000000-0000-4000-8000-000000000023';
 const otherProperty='00000000-0000-4000-8000-000000000024';
 const cmd1='00000000-0000-4000-8000-000000000031';
 const cmd2='00000000-0000-4000-8000-000000000032';
 await db.exec(`create role authenticated; create role anon;create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
   select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth,public to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
  insert into auth.users values ('${owner}'),('${member}'),('${viewer}'),('${outsider}');`);
 await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql',import.meta.url),'utf8'));
 await db.exec(`
  insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
  insert into public.oj_memberships(organization_id,user_id,role,display_name) values
   ('${org}','${owner}','owner','Owner'),('${org}','${member}','member','Member'),
   ('${org}','${viewer}','viewer','Viewer'),('${other}','${outsider}','owner','Outsider');
  create table public.oj_commercial_projects (
   organization_id uuid not null references public.oj_organizations(id),
   id uuid not null,title text not null,phase text not null,
   primary key(organization_id,id)
  );
  insert into public.oj_commercial_projects values ('${org}','${project}','Warehouse cleaning','scoping');`);
 await db.exec(await readFile(new URL('../docs/production-sql/20261026173732_oj_commercial_accounts_u2.sql',import.meta.url),'utf8'));
 await db.exec(`
  insert into public.oj_commercial_accounts(organization_id,id,name,revision,created_by,updated_by)
   values ('${org}','${account}','Warehouse Group',1,'${owner}','${owner}');
  insert into public.oj_commercial_properties(organization_id,account_id,id,name)
   values ('${org}','${account}','${property}','North campus');
  insert into public.oj_commercial_accounts(organization_id,id,name,revision,created_by,updated_by)
   values ('${other}','${other}','Other company',1,'${outsider}','${outsider}');
  insert into public.oj_commercial_properties(organization_id,account_id,id,name)
   values ('${other}','${other}','${otherProperty}','Outsider property');`);
 await db.exec(await readFile(new URL('../docs/production-sql/20261026174014_oj_commercial_project_property_links_u2b.sql',import.meta.url),'utf8'));
 const as=(who:string,role='authenticated')=>db.exec(`reset role;set request.jwt.claim.sub='${who}';set role ${role};`);
 const save=(revision:number,command:string,selectedAccount:string|null=account,
  selectedProperty:string|null=property,tenant=org)=>
  db.query<{v:{ok:boolean;revision?:number;replayed?:boolean;conflict?:boolean;currentRevision?:number}}>(
   'select public.oj_commercial_project_link_save($1,$2,$3,$4,$5,$6) v',
   [tenant,project,revision,command,selectedAccount,selectedProperty]);
 const read=()=>db.query<{v:{accountId:string|null;propertyId:string|null;revision:number}|null}>(
  'select public.oj_commercial_project_link_get($1,$2) v',[org,project]);
 const list=()=>db.query<{v:{projects:Array<{projectId:string;propertyId:string}>;hasMore:boolean}}>(
  'select public.oj_commercial_account_projects($1,$2) v',[org,account]);
 await t.test('owner links an exact saved project, member gets same property and replay receipt',async()=>{
  await as(owner);
  assert.equal((await read()).rows[0].v,null);
  assert.equal((await save(0,cmd1)).rows[0].v.revision,1);
  assert.equal((await save(0,cmd1)).rows[0].v.replayed,true);
  await assert.rejects(()=>save(0,cmd1,account,null));
  await as(member);
  const doc=(await read()).rows[0].v;
  assert.equal(doc?.accountId,account);
  assert.equal(doc?.propertyId,property);
  assert.equal((await list()).rows[0].v.projects[0].projectId,project);
  await assert.rejects(()=>db.query('select * from public.oj_commercial_project_links'));
  await assert.rejects(()=>db.query('select * from oj_private.oj_commercial_project_link_commands'));
 });
 await t.test('stale edits conflict, illegal property cross-tenant link refused, explicit detach keeps project',async()=>{
  await as(owner);
  await assert.rejects(()=>save(1,'00000000-0000-4000-8000-000000000033',account,otherProperty));
  const detached=await save(1,cmd2,null,null);
  assert.equal(detached.rows[0].v.revision,2);
  const stale=await save(1,'00000000-0000-4000-8000-000000000034');
  assert.equal(stale.rows[0].v.conflict,true);
  assert.equal(stale.rows[0].v.currentRevision,2);
  assert.equal((await read()).rows[0].v?.accountId,null);
  assert.equal((await list()).rows[0].v.projects.length,0);
  const reattached=await save(2,'00000000-0000-4000-8000-000000000035');
  assert.equal(reattached.rows[0].v.revision,3);
  await db.exec('reset role');
  assert.equal((await db.query<{n:number}>('select count(*)::integer as n from public.oj_commercial_projects')).rows[0].n,1);
  await assert.rejects(()=>db.query('delete from oj_private.oj_commercial_project_link_commands'));
 });
 await t.test('viewer, outsider, anonymous and revoked member cannot read, list or link',async()=>{
  for(const who of [viewer,outsider]){
   await as(who);
   await assert.rejects(()=>read());
   await assert.rejects(()=>list());
   await assert.rejects(()=>save(3,'00000000-0000-4000-8000-000000000036'));
  }
  await db.exec('reset role;reset request.jwt.claim.sub;set role anon');
  await assert.rejects(()=>read());
  await assert.rejects(()=>list());
  await db.exec(`reset role;delete from public.oj_memberships where organization_id='${org}' and user_id='${member}'`);
  await as(member);
  await assert.rejects(()=>read());
  await assert.rejects(()=>save(3,'00000000-0000-4000-8000-000000000037'));
 });
});
