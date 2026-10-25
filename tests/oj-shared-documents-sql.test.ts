import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { newFieldLog } from '../src/lib/exterior-field-log';

test('shared OJ draft SQL enforces current membership, source ownership, CAS, replay and private history', async t => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001';
  const otherOrg = '00000000-0000-4000-8000-000000000002';
  const owner = '00000000-0000-4000-8000-000000000011';
  const member = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  const outsider = '00000000-0000-4000-8000-000000000014';
  const lead = '00000000-0000-4000-8000-000000000021';
  const bookingId = '00000000-0000-4000-8000-000000000023';
  const command1 = '00000000-0000-4000-8000-000000000031';
  const command2 = '00000000-0000-4000-8000-000000000032';
  const value = { schema:1, current: {schema:1,leadId:lead,sourceUpdatedAt:null,sourceQuote:null,
    lines:[{id:'line-1',service:'Exterior service',quantity:1,unit:'flat',pricePerUnit:250,costPerUnit:null,notes:''}],
    discount:0,travelCost:null,contingencyPct:0},revisions:[] };
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${member}'),('${viewer}'),('${outsider}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql',import.meta.url),'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${otherOrg}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
      ('${org}','${owner}','owner','Owner'),('${org}','${member}','member','Member'),
      ('${org}','${viewer}','viewer','Viewer'),('${otherOrg}','${outsider}','owner','Other founder');
    create table oj_private.legacy_owner(organization_id uuid primary key references public.oj_organizations(id));
    insert into oj_private.legacy_owner values ('${org}');
    create table public.leads(id uuid primary key);
    create table public.bookings(id uuid primary key,lead_id uuid references public.leads(id),date date,status text);
    insert into public.leads values ('${lead}');
    insert into public.bookings values ('${bookingId}','${lead}','2026-10-26','confirmed');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261026000000_oj_workspace_module_documents.sql',import.meta.url),'utf8'));
  const as = (id:string, role='authenticated')=>db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
  const save = (command:string,expected:number,payload=value,tenant=org)=>
    db.query<{result:{ok:boolean;replayed?:boolean;revision?:number;conflict?:boolean;currentRevision?:number}}>(
      'select public.oj_module_document_save($1,$2,$3,$4,$5,$6::jsonb) result',
      [tenant,'exterior_estimate',lead,expected,command,JSON.stringify(payload)]);

  await t.test('owner writes, member reads and exact retries are idempotent', async()=>{
    await as(owner);
    const created=await save(command1,0);
    assert.equal(created.rows[0].result.revision,1);
    const replay=await save(command1,0);
    assert.equal(replay.rows[0].result.replayed,true);
    await assert.rejects(()=>save(command1,0,{...value,current:{...value.current,discount:10}}));
    await as(member);
    const read=await db.query<{value:{revision:number;payload:{current:{leadId:string}}}}>(
      'select public.oj_module_document_get($1,$2,$3) value',[org,'exterior_estimate',lead]);
    assert.equal(read.rows[0].value.revision,1);
    assert.equal(read.rows[0].value.payload.current.leadId,lead);
    await assert.rejects(()=>db.query('select * from oj_private.oj_module_documents'));
  });
  await t.test('stale edits fail closed; a new revision never overwrites evidence', async()=>{
    await as(owner);
    const updated=await save(command2,1,{...value,current:{...value.current,discount:5}});
    assert.equal(updated.rows[0].result.revision,2);
    const stale=await save('00000000-0000-4000-8000-000000000033',1);
    assert.equal(stale.rows[0].result.conflict,true);
    assert.equal(stale.rows[0].result.currentRevision,2);
    await db.exec('reset role');
    const history=await db.query('select revision from oj_private.oj_module_versions order by revision');
    assert.deepEqual(history.rows.map((v:any)=>v.revision),[1,2]);
    await assert.rejects(()=>db.query('delete from oj_private.oj_module_versions where revision=1'));
  });
  await t.test('field draft source binding, access control and booking drift',async()=>{
    const field=newFieldLog({
      id:bookingId,lead_id:lead,date:'2026-10-26',status:'confirmed'
    } as Parameters<typeof newFieldLog>[0]);
    const saveField=(payload:unknown,command:string,expected=0,tenant=org)=>db.query<{result:{revision?:number;ok:boolean;replayed?:boolean}}>(
      'select public.oj_module_document_save($1,$2,$3,$4,$5,$6::jsonb) result',
      [tenant,'exterior_field',bookingId,expected,command,JSON.stringify(payload)]);
    await as(owner);
    const first=await saveField(field,'00000000-0000-4000-8000-000000000060');
    assert.equal(first.rows[0].result.revision,1);
    assert.equal((await saveField(field,'00000000-0000-4000-8000-000000000060')).rows[0].result.replayed,true);
    await assert.rejects(()=>saveField({...field,leadId:otherOrg},'00000000-0000-4000-8000-000000000061',1));
    await assert.rejects(()=>saveField({...field,bookingId:lead},'00000000-0000-4000-8000-000000000062',1));
    await db.exec(`reset role; update public.bookings set status='cancelled' where id='${bookingId}'`);
    await as(owner);
    await assert.rejects(()=>saveField(field,'00000000-0000-4000-8000-000000000063',1));
    await db.exec(`reset role; update public.bookings set status='confirmed' where id='${bookingId}'`);
    await as(member);
    const loaded=await db.query<{v:{revision:number;payload:{bookingId:string}}}>(
      'select public.oj_module_document_get($1,$2,$3) v',[org,'exterior_field',bookingId]);
    assert.equal(loaded.rows[0].v.revision,1);
    assert.equal(loaded.rows[0].v.payload.bookingId,bookingId);
    await assert.rejects(()=>db.query('select * from oj_private.oj_module_versions'));
    await as(outsider);
    await assert.rejects(()=>db.query('select public.oj_module_document_get($1,$2,$3)',[org,'exterior_field',bookingId]));
  });
  await t.test('viewer, anonymous, outsider and revoked member cannot read or write',async()=>{
    for(const subject of [viewer,outsider]){
      await as(subject);
      await assert.rejects(()=>db.query('select public.oj_module_document_get($1,$2,$3)',[org,'exterior_estimate',lead]));
      await assert.rejects(()=>save('00000000-0000-4000-8000-000000000034',0));
    }
    await db.exec('reset role; reset request.jwt.claim.sub; set role anon');
    await assert.rejects(()=>db.query('select public.oj_module_document_get($1,$2,$3)',[org,'exterior_estimate',lead]));
    await db.exec(`reset role; delete from public.oj_memberships where organization_id='${org}' and user_id='${member}'`);
    await as(member);
    await assert.rejects(()=>db.query('select public.oj_module_document_get($1,$2,$3)',[org,'exterior_estimate',lead]));
  });
  await t.test('direct RPC clients cannot write unvalidated module types or malformed records',async()=>{
    await as(owner);
    await assert.rejects(()=>db.query(
      'select public.oj_module_document_save($1,$2,$3,$4,$5,$6::jsonb)',
      [org,'exterior_field',lead,0,'00000000-0000-4000-8000-000000000039',JSON.stringify(value)]
    ));
    await assert.rejects(()=>db.query(
      'select public.oj_module_document_save($1,$2,$3,$4,$5,$6::jsonb)',
      [org,'exterior_estimate',lead,2,'00000000-0000-4000-8000-000000000040',JSON.stringify({current:{leadId:lead}})]
    ));
    await assert.rejects(()=>db.query(
      'select public.oj_module_document_save($1,$2,$3,$4,$5,$6::jsonb)',
      [org,'fleet','main',0,'00000000-0000-4000-8000-000000000041',JSON.stringify({organizationId:org})]
    ));
  });
  await t.test('foreign organization cannot claim a legacy source',async()=>{
    await as(outsider);
    await assert.rejects(()=>save('00000000-0000-4000-8000-000000000035',0,value,otherOrg));
  });
  await db.close();
});
