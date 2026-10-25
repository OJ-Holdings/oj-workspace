import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyFieldCrewPlan } from '../src/lib/atlas-field-mission';
import { recoveryProjectId } from '../src/lib/commercial-persistence';

test('legacy recovery IDs map deterministically to tenant-scoped UUIDv8 values', async () => {
  const orgA = '00000000-0000-4000-8000-000000000001';
  const orgB = '00000000-0000-4000-8000-000000000002';
  const [first, retry, otherTenant] = await Promise.all([
    recoveryProjectId(orgA, 'legacy-project-42'),
    recoveryProjectId(orgA, 'legacy-project-42'),
    recoveryProjectId(orgB, 'legacy-project-42'),
  ]);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(retry, first);
  assert.notEqual(otherTenant, first);
  assert.equal(await recoveryProjectId(orgA, '00000000-0000-4000-8000-000000000099'), '00000000-0000-4000-8000-000000000099');
  await assert.rejects(() => recoveryProjectId(orgA, 'unsafe/legacy/id'));
});

test('commercial estimate RPCs enforce tenant roles, immutable versions, CAS and idempotency', async t => {
  const db = new PGlite();
  const org = '00000000-0000-4000-8000-000000000001';
  const otherOrg = '00000000-0000-4000-8000-000000000002';
  const owner = '00000000-0000-4000-8000-000000000011';
  const member = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  const outsider = '00000000-0000-4000-8000-000000000014';
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${member}'),('${viewer}'),('${outsider}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/schemas/collaboration.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${org}','OJ'),('${otherOrg}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
      ('${org}','${owner}','owner','Oscar'),('${org}','${member}','member','Jacob'),
      ('${org}','${viewer}','viewer','Viewer'),('${otherOrg}','${outsider}','owner','Outsider');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261025000000_oj_commercial_estimating_shared_records.sql', import.meta.url), 'utf8'));
  const as = async (id: string, role = 'authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
  const project = '00000000-0000-4000-8000-000000000021';
  const command1 = '00000000-0000-4000-8000-000000000031';
  const command2 = '00000000-0000-4000-8000-000000000032';
  const draft = {
    name: 'Campus wash', input: newEstimate(), review: [false,false,false,false,false], phase: 'scoping',
    bookingId: null, plannedAssetIds: [], fieldCrewPlan: emptyFieldCrewPlan(),
  };

  await t.test('owner creates and member reads a shared version; direct cost-table access stays private', async () => {
    await as(owner);
    const first = await db.query<{ receipt: { ok: boolean; revision: number; replayed: boolean } }>(
      `select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb) receipt`,
      [org, project, command1, JSON.stringify(draft)],
    );
    assert.equal(first.rows[0].receipt.ok, true);
    assert.equal(first.rows[0].receipt.revision, 1);
    assert.equal(first.rows[0].receipt.replayed, false);
    await db.query(`select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb)`, [
      org, '00000000-0000-4000-8000-000000000022', command2,
      JSON.stringify({ ...draft, name: 'Second site' }),
    ]);
    await as(member);
    const got = await db.query<{ project: Record<string, any> }>(`select public.oj_commercial_project_get($1,$2) project`, [org, project]);
    assert.equal(got.rows[0].project.id, project);
    assert.equal(got.rows[0].project.revision, 1);
    assert.equal(got.rows[0].project.name, 'Campus wash');
    assert.equal('scenarioPrice' in got.rows[0].project, false);
    assert.equal(JSON.stringify(got.rows[0].project).includes('laborRate'), true);
    await assert.rejects(() => db.query(`select * from oj_private.oj_commercial_cost_assumptions`));
    const firstPage = await db.query<{ page: { projects: unknown[]; hasMore: boolean; nextUpdatedAt: string; nextId: string } }>(
      `select public.oj_commercial_projects_list($1,1,null,null) page`, [org]);
    assert.equal(firstPage.rows[0].page.projects.length, 1);
    assert.equal(firstPage.rows[0].page.hasMore, true);
    const secondPage = await db.query<{ page: { projects: unknown[]; hasMore: boolean } }>(
      `select public.oj_commercial_projects_list($1,1,$2,$3) page`,
      [org, firstPage.rows[0].page.nextUpdatedAt, firstPage.rows[0].page.nextId],
    );
    assert.equal(secondPage.rows[0].page.projects.length, 1);
    assert.equal(secondPage.rows[0].page.hasMore, false);
  });

  await t.test('retries do not duplicate versions; stale revisions and command reuse fail safely', async () => {
    await as(owner);
    const replay = await db.query<{ receipt: { replayed: boolean; revision: number } }>(
      `select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb) receipt`,
      [org, project, command1, JSON.stringify(draft)],
    );
    assert.equal(replay.rows[0].receipt.replayed, true);
    await db.exec('reset role');
    assert.equal((await db.query(`select * from public.oj_commercial_estimate_versions`)).rows.length, 2);
    await as(owner);
    const changed = { ...draft, name: 'Changed payload' };
    await assert.rejects(() => db.query(`select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb)`, [org, project, command1, JSON.stringify(changed)]));
    const secondCommand = '00000000-0000-4000-8000-000000000034';
    const second = await db.query<{ receipt: { ok: boolean; revision: number } }>(
      `select public.oj_commercial_project_save($1,$2,1,$3,$4::jsonb) receipt`,
      [org, project, secondCommand, JSON.stringify(changed)],
    );
    assert.equal(second.rows[0].receipt.ok, true);
    assert.equal(second.rows[0].receipt.revision, 2);
    const conflictCommand = '00000000-0000-4000-8000-000000000035';
    const conflict = await db.query<{ receipt: { conflict: boolean; currentRevision: number } }>(
      `select public.oj_commercial_project_save($1,$2,1,$3,$4::jsonb) receipt`,
      [org, project, conflictCommand, JSON.stringify({ ...changed, name: 'Stale edit' })],
    );
    assert.equal(conflict.rows[0].receipt.conflict, true);
    assert.equal(conflict.rows[0].receipt.currentRevision, 2);
    const updateCommand = '00000000-0000-4000-8000-000000000033';
    const update = await db.query<{ receipt: { ok: boolean; revision: number } }>(
      `select public.oj_commercial_project_save($1,$2,2,$3,$4::jsonb) receipt`,
      [org, project, updateCommand, JSON.stringify(changed)],
    );
    assert.equal(update.rows[0].receipt.revision, 3);
    await db.exec('reset role');
    assert.equal((await db.query(`select * from public.oj_commercial_estimate_versions`)).rows.length, 4);
    assert.equal((await db.query(`select * from oj_private.oj_commercial_cost_assumptions`)).rows.length, 4);
    assert.equal((await db.query(`select * from public.oj_commercial_history`)).rows.length, 4);
  });

  await t.test('viewers, anonymous users and other organizations cannot read or write', async () => {
    await as(viewer);
    await assert.rejects(() => db.query(`select public.oj_commercial_projects_list($1,10,null,null)`, [org]));
    await assert.rejects(() => db.query(`select public.oj_commercial_project_get($1,$2)`, [org, project]));
    await assert.rejects(() => db.query(`select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb)`, [org, project, command2, JSON.stringify(draft)]));
    await as(outsider);
    await assert.rejects(() => db.query(`select public.oj_commercial_projects_list($1,10,null,null)`, [org]));
    await assert.rejects(() => db.query(`select public.oj_commercial_project_get($1,$2)`, [org, project]));
    await as('', 'anon');
    await assert.rejects(() => db.query(`select public.oj_commercial_projects_list($1,10,null,null)`, [org]));
    await assert.rejects(() => db.query(`select * from public.oj_commercial_projects`));
  });

  await t.test('database rejects malformed or out-of-range commercial inputs', async () => {
    await as(owner);
    const invalidCost = { ...draft, input: { ...draft.input, margin: 99 } };
    await assert.rejects(() => db.query(`select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb)`, [org, '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000041', JSON.stringify(invalidCost)]));
    const forgedFields = { ...draft, quoteSent: true };
    await assert.rejects(() => db.query(`select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb)`, [org, '00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000042', JSON.stringify(forgedFields)]));
    const invalidCrew = { ...draft, fieldCrewPlan: { ...draft.fieldCrewPlan, crewSize: 41 } };
    await assert.rejects(() => db.query(`select public.oj_commercial_project_save($1,$2,null,$3,$4::jsonb)`, [org, '00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000043', JSON.stringify(invalidCrew)]));
    await assert.rejects(() => db.query(`select public.oj_commercial_projects_list($1,101,null,null)`, [org]));
  });

  await db.close();
});
