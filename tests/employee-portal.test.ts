import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('employee portal isolates access, invitations, closeouts and commission records', async t => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001';
  const owner = '00000000-0000-4000-8000-000000000011';
  const edy = '00000000-0000-4000-8000-000000000012';
  const otherEmployee = '00000000-0000-4000-8000-000000000013';
  const viewer = '00000000-0000-4000-8000-000000000014';
  const booking1 = '00000000-0000-4000-8000-000000000021';
  const booking2 = '00000000-0000-4000-8000-000000000022';
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values
      ('${owner}','owner@example.test',now()),('${edy}','edy@example.test',now()),
      ('${otherEmployee}','other@example.test',now()),('${viewer}','viewer@example.test',now());
    create table public.leads(id uuid primary key default gen_random_uuid(),name text,address text,service_requested text,status text,job_revenue numeric);
    create table public.bookings(id uuid primary key default gen_random_uuid(),lead_id uuid references public.leads(id),date date,time_block text,status text);
    alter table public.leads enable row level security; alter table public.bookings enable row level security;
    revoke all on public.leads,public.bookings from public,anon,authenticated;
    grant select on public.leads,public.bookings to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values('${org}','OJ');`);
  await db.exec(await readFile(new URL('../supabase/schemas/collaboration.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','Viewer');
    insert into public.leads(id,name,address,service_requested,status,job_revenue) values
      ('00000000-0000-4000-8000-000000000031','Private client one','1 Secret Lane','Window cleaning','completed',425.55),
      ('00000000-0000-4000-8000-000000000032','Private client two','2 Secret Lane','Gutter cleaning','booked',null);
    insert into public.bookings(id,lead_id,date,time_block,status) values
      ('${booking1}','00000000-0000-4000-8000-000000000031','2026-10-20','9:00 AM','confirmed'),
      ('${booking2}','00000000-0000-4000-8000-000000000032','2026-10-21','1:00 PM','confirmed');`);
  await db.exec(await readFile(new URL('../supabase/pending/employee-portal.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_private.employees(organization_id,user_id,email,display_name) values('${org}','${otherEmployee}','other@example.test','Other');`);
  const as = async (id: string, role = 'authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
  const token = (n: number) => n.toString(16).padStart(64,'0');
  const digest = (n: number) => createHash('sha256').update(token(n)).digest('hex');
  const checklist = [{ text: 'Complete the service', done: false }];

  await t.test('employee invitation is owner-only, email-bound and does not create workspace membership', async () => {
    await as(owner);
    const id = (await db.query<{id:string}>(`select public.oj_create_employee_invitation($1,$2,$3) id`,[org,'edy@example.test',digest(1)])).rows[0].id;
    const revokedId = (await db.query<{id:string}>(`select public.oj_create_employee_invitation($1,$2,$3) id`,[org,'revoked@example.test',digest(2)])).rows[0].id;
    await db.query(`select public.oj_revoke_employee_invitation($1,$2)`,[org,revokedId]);
    const expiredId = (await db.query<{id:string}>(`select public.oj_create_employee_invitation($1,$2,$3) id`,[org,'expired@example.test',digest(3)])).rows[0].id;
    await db.exec('reset role');
    await db.query(`update oj_private.employee_invitations set expires_at=now()-interval '1 second' where id=$1`,[expiredId]);
    assert.ok(id);
    await as(viewer);
    await assert.rejects(() => db.query(`select public.oj_create_employee_invitation($1,$2,$3)`,[org,'other@example.test',digest(2)]));
    await as('','anon');
    assert.equal((await db.query<{valid:boolean}>(`select public.oj_validate_employee_invitation($1,$2) valid`,[token(1),'edy@example.test'])).rows[0].valid,true);
    assert.equal((await db.query<{valid:boolean}>(`select public.oj_validate_employee_invitation($1,$2) valid`,[token(1),'other@example.test'])).rows[0].valid,false);
    assert.equal((await db.query<{valid:boolean}>(`select public.oj_validate_employee_invitation($1,$2) valid`,[token(2),'revoked@example.test'])).rows[0].valid,false);
    assert.equal((await db.query<{valid:boolean}>(`select public.oj_validate_employee_invitation($1,$2) valid`,[token(3),'expired@example.test'])).rows[0].valid,false);
    await as(edy);
    await db.exec('reset role');
    await db.exec(`update auth.users set email_confirmed_at=null where id='${edy}'`);
    await assert.rejects(() => db.query(`select public.oj_accept_employee_invitation($1,$2)`,[token(1),'Edy']));
    await db.exec('reset role');
    await db.exec(`update auth.users set email_confirmed_at=now() where id='${edy}'`);
    await as(edy);
    await db.query(`select public.oj_accept_employee_invitation($1,$2)`,[token(1),'Edy']);
    assert.equal((await db.query('select * from public.oj_memberships')).rows.length,0);
    await assert.rejects(() => db.query(`select public.oj_accept_employee_invitation($1,$2)`,[token(1),'Edy']));
  });

  await t.test('owner assigns one job with an explicit rate and private instructions', async () => {
    await as(owner);
    await db.query(`select public.oj_employee_assignment_save($1,$2,$3,$4,$5,$6::jsonb)`,[org,booking1,edy,12.5,'Bring extension poles',JSON.stringify(checklist)]);
    await db.query(`select public.oj_employee_assignment_save($1,$2,$3,$4,$5,$6::jsonb)`,[org,booking2,otherEmployee,15,'Other instructions','[]']);
    await assert.rejects(() => db.query(`select public.oj_employee_assignment_save($1,$2,$3,$4,$5,$6::jsonb)`,[org,booking2,edy,null,'','[]']));
    await assert.rejects(() => db.query(`select public.oj_employee_assignment_save($1,$2,$3,$4,$5,$6::jsonb)`,[org,booking2,edy,101,'','[]']));
  });

  await t.test('employee RPC returns only own assigned work and direct company tables stay denied', async () => {
    await as(edy);
    const jobs=(await db.query<{service:string;address:string;instructions:string;commission_percent:number;commission_estimate:number}>(`select * from public.oj_employee_jobs()`)).rows;
    assert.equal(jobs.length,1);
    assert.equal(jobs[0].service,'Window cleaning');
    assert.equal(jobs[0].address,'1 Secret Lane');
    assert.equal(jobs[0].instructions,'Bring extension poles');
    assert.equal(Number(jobs[0].commission_percent),12.5);
    assert.equal(Number(jobs[0].commission_estimate),53.19);
    const jobShape=(await db.query<{job:Record<string,unknown>}>(`select to_jsonb(j) as job from public.oj_employee_jobs() j`)).rows[0].job;
    assert.equal('customer_paid' in jobShape,false);
    assert.equal('job_revenue' in jobShape,false);
    assert.equal((await db.query('select * from public.leads')).rows.length,0);
    assert.equal((await db.query('select * from public.bookings')).rows.length,0);
    await assert.rejects(() => db.query('select * from oj_private.employees'));
    await assert.rejects(() => db.query(`select public.oj_employee_assignment_save($1,$2,$3,50,'','[]'::jsonb)`,[org,booking2,edy]));
    await as(otherEmployee);
    assert.equal((await db.query('select * from public.oj_employee_jobs()')).rows.length,1);
  });

  await t.test('closeout transitions are scoped to the assigned employee and become immutable at submission', async () => {
    await as(edy);
    const assignment=(await db.query<{assignment_id:string}>(`select assignment_id from public.oj_employee_jobs()`)).rows[0].assignment_id;
    await db.query(`select public.oj_employee_closeout_update($1,'accepted',$2::jsonb,'Starting')`,[assignment,JSON.stringify([{text:'Complete the service',done:false}])]);
    await db.query(`select public.oj_employee_closeout_update($1,'in_progress',$2::jsonb,'On site')`,[assignment,JSON.stringify([{text:'Complete the service',done:true}])]);
    await db.query(`select public.oj_employee_closeout_update($1,'submitted',$2::jsonb,'Finished')`,[assignment,JSON.stringify([{text:'Complete the service',done:true}])]);
    await assert.rejects(() => db.query(`select public.oj_employee_closeout_update($1,'in_progress','[]'::jsonb,'Change')`,[assignment]));
    await as(owner);
    await db.query(`select public.oj_employee_closeout_verify($1,$2)`,[org,assignment]);
  });

  await t.test('owner approves commission only for completed paid work; employee sees approval and payout state', async () => {
    await as(owner);
    const assignment=(await db.query<{assignment_id:string}>(`select assignment_id from public.oj_employee_assignment_list($1) where booking_id=$2`,[org,booking1])).rows[0].assignment_id;
    const earning=(await db.query<{oj_employee_commission_approve:string}>(`select public.oj_employee_commission_approve($1,$2)`,[org,assignment])).rows[0].oj_employee_commission_approve;
    await assert.rejects(() => db.query(`select public.oj_employee_commission_approve($1,$2)`,[org,assignment]));
    await assert.rejects(() => db.query(`select public.oj_employee_assignment_save($1,$2,$3,15,'Rate correction without reason',$4::jsonb)`,[org,booking1,edy,JSON.stringify([{text:'Complete the service',done:true}])]));
    await assert.rejects(() => db.query(`select public.oj_employee_commission_adjust($1,$2,0.001,'Sub-cent adjustment')`,[org,earning]));
    const adjustment=(await db.query<{oj_employee_commission_adjust:string}>(`select public.oj_employee_commission_adjust($1,$2,20,'Owner correction after payment reconciliation')`,[org,earning])).rows[0].oj_employee_commission_adjust;
    await as(edy);
    let earnings=(await db.query<{amount:number;status:string}>(`select * from public.oj_employee_earnings()`)).rows;
    assert.equal(earnings.length,2); assert.equal(Number(earnings.find(row => Number(row.amount) === 53.19)?.amount),53.19); assert.equal(Number(earnings.find(row => Number(row.amount) === 20)?.amount),20);
    await assert.rejects(() => db.query(`select public.oj_employee_commission_paid($1,$2)`,[org,earning]));
    await as(owner);
    await db.query(`select public.oj_employee_commission_paid($1,$2)`,[org,earning]);
    await assert.rejects(() => db.query(`select public.oj_employee_commission_paid($1,$2)`,[org,earning]));
    await db.query(`select public.oj_employee_commission_paid($1,$2)`,[org,adjustment]);
    await as(edy);
    earnings=(await db.query<{amount:number;status:string}>(`select * from public.oj_employee_earnings()`)).rows;
    assert.equal(earnings[0].status,'paid');
  });

  await db.close();
});
