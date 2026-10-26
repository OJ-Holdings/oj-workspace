import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { contentDraftMatches, freshContentDraft, type ContentProject } from '../src/lib/content-studio';

test('Content Studio staged storage enforces real actor permissions, revisions and activity', async t => {
  const db = new PGlite();
  const org='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
  const owner='00000000-0000-4000-8000-000000000011', member='00000000-0000-4000-8000-000000000012';
  const viewer='00000000-0000-4000-8000-000000000013', outsider='00000000-0000-4000-8000-000000000014';
  const project='00000000-0000-4000-8000-000000000021';
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${member}'),('${viewer}'),('${outsider}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/collaboration.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/dashboard.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/work-leaderboard.sql', import.meta.url),'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','Synthetic OJ'),('${other}','Synthetic Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
      ('${org}','${owner}','owner','Owner'),('${org}','${member}','member','Member'),
      ('${org}','${viewer}','viewer','Viewer'),('${other}','${outsider}','owner','Other');`);
  await db.exec(await readFile(new URL('../supabase/staging/oj-content-studio.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/staging/oj-content-brand-compatibility.sql', import.meta.url),'utf8'));
  const as = (id:string, role='authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
  try {
    await t.test('owner creates; member independently reads actual script and trigger-generated activity', async () => {
      await as(owner);
      await db.query(`insert into public.oj_content_projects(id,organization_id,title,kind,stage,platforms,script,created_by)
        values($1,$2,'Synthetic video','Video','Idea',array['YouTube'],'Actual synthetic script',$3)`,[project,org,owner]);
      await as(member);
      assert.equal((await db.query<{script:string}>(`select script from public.oj_content_projects`)).rows[0].script,'Actual synthetic script');
      const saved = (await db.query<{project:ContentProject}>(`select row_to_json(p) as project from public.oj_content_projects p`)).rows[0].project;
      const draft = {...freshContentDraft(), title:'Synthetic video', script:'Actual synthetic script'};
      assert.equal(contentDraftMatches(draft, saved), true);
      assert.equal(contentDraftMatches({...draft, script:'Truncated'}, saved), false);
      const activity=await db.query<{action:string;actor_id:string}>(`select action,actor_id from public.oj_content_activity`);
      assert.equal(activity.rows[0].action,'created'); assert.equal(activity.rows[0].actor_id,owner);
    });
    await t.test('content brand works in shared tasks, company notes and the existing work timer', async () => {
      await as(owner);
      await db.query(`insert into public.oj_cards(organization_id,title,business) values($1,'Synthetic film task','content')`,[org]);
      await db.query(`insert into public.oj_messages(organization_id,venture,body) values($1,'content','Synthetic production note')`,[org]);
      // The real timer guard owns its timestamps and caller identity.
      await db.query(`insert into public.oj_work_sessions(organization_id,user_id,business) values($1,$2,'content')`,[org,owner]);
      assert.equal((await db.query(`select id from public.oj_cards where business='content'`)).rows.length,1);
      await assert.rejects(db.query(`insert into public.oj_cards(organization_id,title,business) values($1,'Bad brand','invented')`,[org]));
    });
    await t.test('member update increments revision; stale founder write affects zero rows', async () => {
      await as(member);
      const saved=await db.query<{revision:number}>(`update public.oj_content_projects set stage='Script',revision=0 where id=$1 and revision=0 returning revision`,[project]);
      assert.equal(saved.rows[0].revision,1);
      await as(owner);
      assert.equal((await db.query(`update public.oj_content_projects set title='Stale edit',revision=0 where id=$1 and revision=0 returning id`,[project])).rows.length,0);
      assert.equal((await db.query(`select id from public.oj_content_activity`)).rows.length,2);
    });
    await t.test('viewer reads but cannot write or forge immutable history', async () => {
      await as(viewer);
      assert.equal((await db.query(`select id from public.oj_content_projects`)).rows.length,1);
      assert.equal((await db.query(`update public.oj_content_projects set title='Denied' returning id`)).rows.length,0);
      await assert.rejects(db.query(`delete from public.oj_content_projects`));
      await assert.rejects(db.query(`update public.oj_content_activity set action='created'`));
    });
    await t.test('outsider, anonymous and revoked member cannot access company records', async () => {
      await as(outsider);
      assert.equal((await db.query(`select id from public.oj_content_projects`)).rows.length,0);
      assert.equal((await db.query(`select id from public.oj_content_activity`)).rows.length,0);
      await as('', 'anon'); await assert.rejects(db.query(`select id from public.oj_content_projects`));
      await db.exec(`reset role; delete from public.oj_memberships where user_id='${member}'`);
      await as(member);
      assert.equal((await db.query(`select id from public.oj_content_projects`)).rows.length,0);
      assert.equal((await db.query(`update public.oj_content_projects set title='Revoked' returning id`)).rows.length,0);
    });
    await t.test('direct SQL rejects false publication, invalid platforms, wrong assignee and identity changes', async () => {
      await as(owner);
      await assert.rejects(db.query(`update public.oj_content_projects set stage='Published' where id=$1`,[project]));
      await assert.rejects(db.query(`update public.oj_content_projects set platforms=array['YouTube','YouTube'] where id=$1`,[project]));
      await assert.rejects(db.query(`update public.oj_content_projects set platforms=array[null]::text[] where id=$1`,[project]));
      await assert.rejects(db.query(`update public.oj_content_projects set assigned_to=$1 where id=$2`,[outsider,project]));
      await assert.rejects(db.query(`update public.oj_content_projects set organization_id=$1 where id=$2`,[other,project]));
      await assert.rejects(db.query(`update public.oj_content_projects set revision=22 where id=$1`,[project]));
      await assert.rejects(db.query(`insert into public.oj_content_activity(organization_id,project_id,action,new_stage) values($1,$2,'created','Published')`,[org,project]));
    });
  } finally { await db.close(); }
});
