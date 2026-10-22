import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('V2 venture registry preserves historical OJ data and scopes Oscar Jacob to the proper organization', async t => {
  const db = new PGlite();
  const orgA = '00000000-0000-4000-8000-000000000001';
  const orgB = '00000000-0000-4000-8000-000000000002';
  const orgC = '00000000-0000-4000-8000-000000000003';
  const oscar = '00000000-0000-4000-8000-000000000011';
  const jacob = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  const outsider = '00000000-0000-4000-8000-000000000014';
  const projectId = '00000000-0000-4000-8000-000000000021';

  await db.exec(`create role authenticated; create role anon;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${oscar}'),('${jacob}'),('${viewer}'),('${outsider}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/dashboard.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name)
    values ('${orgA}','OJ Holdings'),('${orgB}','Different Company');
    insert into public.oj_memberships(organization_id,user_id,role,display_name)
    values ('${orgA}','${oscar}','owner','Oscar'),
           ('${orgA}','${jacob}','owner','Jacob'),
           ('${orgA}','${viewer}','viewer','Viewer'),
           ('${orgB}','${outsider}','owner','Outsider');
    set request.jwt.claim.sub = '${oscar}';
    insert into public.oj_cards(organization_id,title,business,created_by)
      values ('${orgA}','Legacy Exterior task','exterior','${oscar}');
    insert into public.oj_leads(organization_id,name,venture,created_by)
      values ('${orgA}','Historic Solutions client','solutions','${oscar}');
    insert into public.oj_finance_entries(organization_id,venture,kind,amount,occurred_on,created_by)
      values ('${orgA}','essentials','revenue',150,'2026-10-21','${oscar}');
    insert into public.oj_events(organization_id,title,starts_at,created_by)
      values ('${orgA}','Existing company meeting',now(),'${oscar}');
  `);

  const migration = await readFile(new URL('../supabase/pending/V2-four-business-content-foundation.sql',import.meta.url),'utf8');
  await db.exec(migration);

  const as = async (id: string, role = 'authenticated') =>
    db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role ${role};`);

  await t.test('historic records and their venture identities remain untouched', async () => {
    await as(oscar);
    assert.equal((await db.query<{ business: string }>('select business from public.oj_cards')).rows[0].business,'exterior');
    assert.equal((await db.query<{ venture: string }>('select venture from public.oj_leads')).rows[0].venture,'solutions');
    assert.equal((await db.query<{ venture: string }>('select venture from public.oj_finance_entries')).rows[0].venture,'essentials');
    assert.equal((await db.query('select * from public.oj_events')).rows.length,1);
    assert.deepEqual((await db.query<{slug:string}>('select slug from public.oj_ventures order by sort_order')).rows.map(x=>x.slug),
      ['exterior','solutions','essentials','content']);
  });

  await t.test('founders can save fourth-business tasks and shared records, but never arbitrary business strings', async () => {
    await as(oscar);
    await db.exec(`insert into public.oj_cards(organization_id,title,business)
      values ('${orgA}','Video editing brief','content')`);
    await db.exec(`insert into public.oj_messages(organization_id,venture,body)
      values ('${orgA}','content','Review the script')`);
    await db.exec(`insert into public.oj_documents(organization_id,venture,name,storage_path,size_bytes)
      values ('${orgA}','content','Content production brief','${orgA}/content/brief.pdf',512)`);
    await assert.rejects(() => db.exec(`insert into public.oj_cards(organization_id,title,business)
      values ('${orgA}','Invalid venture','arbitrary-client-input')`));
    await as(jacob);
    assert.equal((await db.query(`select id from public.oj_cards where business='content'`)).rows.length,1);
  });

  await t.test('content project writes create immutable audit events and optimistic revisions', async () => {
    await as(oscar);
    await db.exec(`insert into public.oj_content_projects
      (id,organization_id,title,kind,assigned_to,summary,platforms)
      values ('${projectId}','${orgA}','Pilot episode','Video','${jacob}',
        'Proposed first episode',array['YouTube','TikTok'])`);
    let rows=(await db.query<{revision:number;stage:string}>(
      `select revision,stage from public.oj_content_projects where id='${projectId}'`)).rows;
    assert.equal(rows.length,1);
    assert.equal(rows[0].revision,0);
    await as(jacob);
    await db.exec(`update public.oj_content_projects
      set stage='Script',script='Scene 1',revision=0
      where id='${projectId}' and revision=0`);
    rows=(await db.query<{revision:number;stage:string}>(
      `select revision,stage from public.oj_content_projects where id='${projectId}'`)).rows;
    assert.equal(rows[0].revision,1);
    assert.equal(rows[0].stage,'Script');
    assert.equal((await db.query(`update public.oj_content_projects set title='Stale',revision=0 where id='${projectId}' and revision=0 returning id`)).rows.length,0);
    await assert.rejects(() => db.exec(`update public.oj_content_projects set revision=200 where id='${projectId}'`));
    const events=(await db.query<{action:string;actor_id:string;new_stage:string}>(
      'select action,actor_id,new_stage from public.oj_content_activity order by changed_at, id')).rows;
    assert.equal(events.length,2);
    assert.ok(events.some(e=>e.action==='created' && e.actor_id===oscar && e.new_stage==='Idea'));
    assert.ok(events.some(e=>e.action==='stage_changed' && e.actor_id===jacob && e.new_stage==='Script'));
    await assert.rejects(() => db.exec('delete from public.oj_content_activity'));
    await assert.rejects(() => db.exec(`insert into public.oj_content_activity(organization_id,project_id,action)
      values ('${orgA}','${projectId}','updated')`));
  });

  await t.test('publication cannot be asserted without a recorded link and date', async () => {
    await as(jacob);
    await assert.rejects(() => db.exec(`update public.oj_content_projects
      set stage='Published',revision=1 where id='${projectId}'`));
    await assert.rejects(() => db.exec(`update public.oj_content_projects
      set stage='Published',published_url='javascript:alert(1)',published_at=now(),revision=1 where id='${projectId}'`));
    await db.exec(`update public.oj_content_projects
      set stage='Published',published_url='https://example.com/video/one',published_at=now(),revision=1
      where id='${projectId}'`);
    assert.equal((await db.query(`select id from public.oj_content_projects where stage='Published'`)).rows.length,1);
  });

  await t.test('viewer can read but cannot add, edit, or falsify company production activity', async () => {
    await as(viewer);
    assert.equal((await db.query('select * from public.oj_content_projects')).rows.length,1);
    assert.equal((await db.query('select * from public.oj_content_activity')).rows.length,3);
    await assert.rejects(() => db.exec(`insert into public.oj_content_projects(organization_id,title)
      values ('${orgA}','Viewer attempt')`));
    assert.equal((await db.query(`update public.oj_content_projects set title='Viewer edit' returning id`)).rows.length,0);
  });

  await t.test('outsiders and anonymous clients never see another organization content', async () => {
    await as(outsider);
    assert.equal((await db.query('select id from public.oj_content_projects')).rows.length,0);
    assert.equal((await db.query('select id from public.oj_content_activity')).rows.length,0);
    await assert.rejects(()=>db.exec(`insert into public.oj_content_projects(organization_id,title)
      values ('${orgA}','Forged cross-tenant')`));
    await as('', 'anon');
    await assert.rejects(()=>db.query('select id from public.oj_content_projects'));
    await assert.rejects(()=>db.query('select id from public.oj_ventures'));
  });

  await t.test('assignment to a foreign workspace user and moving projects across orgs are forbidden', async () => {
    await as(oscar);
    await assert.rejects(()=>db.exec(`update public.oj_content_projects
      set assigned_to='${outsider}',revision=2 where id='${projectId}'`));
    await assert.rejects(()=>db.exec(`update public.oj_content_projects
      set organization_id='${orgB}' where id='${projectId}'`));
    await assert.rejects(()=>db.exec(`insert into public.oj_content_projects
      (organization_id,title,created_by) values ('${orgA}','Forged creator','${jacob}')`));
  });

  await t.test('future organizations receive four correctly scoped default business rows', async () => {
    await db.exec('reset role');
    await db.exec(`insert into public.oj_organizations(id,name) values ('${orgC}','New Organization')`);
    const rows=(await db.query<{slug:string}>(`select slug from public.oj_ventures
      where organization_id='${orgC}' order by sort_order`)).rows;
    assert.deepEqual(rows.map(r=>r.slug),['exterior','solutions','essentials','content']);
  });

  await db.close();
});
