import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { effectiveOutreachStatus, isOutreachComplete, outreachStatuses, safeOutreachUrl } from '../src/lib/outreach';
import { outreachKey, parseOutreachRows } from '../src/lib/outreach-import';

const headers = ['Business Name','Industry','City and State','Website URL','Phone Number','Decision Maker','Best Fit Service','Secondary Fit','The Leak','Evidence','Email','Instagram','Facebook','Email Subject','Email Body','DM','Date Added','Sent By','Outreach Status','Notes'];

test('outreach rows map the real sheet headers, dates, owners and statuses', () => {
  const result = parseOutreachRows([headers, ['Kenosha Dental','Dental','Kenosha, WI','https://www.example.com/about','262-555-0100','Sam Lee','AI Receptionist','Website','Missed calls','Hours page says weekends closed','sam@example.com','@kenoshadental','','A useful subject','Email body','Short DM','10/18/2026','Jacob','Emailed','Called once']]);
  assert.equal(result.prospects.length, 1);
  assert.equal(result.prospects[0].business_name, 'Kenosha Dental');
  assert.equal(result.prospects[0].date_added, '2026-10-18');
  assert.equal(result.prospects[0].sent_by, 'Jacob');
  assert.equal(result.prospects[0].source_status, 'Emailed');
  assert.equal(result.prospects[0].website_url, 'https://www.example.com/about');
  assert.deepEqual(result.skippedRows, []);
});

test('daily sync accepts the live Sender/Send To/Message/Trade sheet without inventing dates', () => {
  const liveHeaders = ['Sender','Channel','Send To','Subject','Message','Status','Notes','Business Name','Decision Maker','Best Fit Service','The Leak','Instagram','Facebook','Email','Trade','City and State','Website URL','Phone Number'];
  const result = parseOutreachRows([liveHeaders, [
    'Jacob','Email','austinmedspa@gmail.com','your about page','A short outreach message','Not Sent','','Austin Med Spa',
    'Suzette Smith, Owner','Website','Placeholder text on the about page.','https://instagram.com/austinmedspa','','austinmedspa@gmail.com',
    'Med Spa','Austin, TX','https://www.austinmedspa.com/','(512) 479-9997',
  ]]);
  assert.equal(result.prospects.length, 1);
  assert.equal(result.prospects[0].business_name, 'Austin Med Spa');
  assert.equal(result.prospects[0].industry, 'Med Spa');
  assert.equal(result.prospects[0].email, 'austinmedspa@gmail.com');
  assert.equal(result.prospects[0].email_subject, 'your about page');
  assert.equal(result.prospects[0].email_body, 'A short outreach message');
  assert.equal(result.prospects[0].sent_by, 'Jacob');
  assert.equal(result.prospects[0].date_added, null);
  assert.equal(result.prospects[0].source_status, 'Not Sent');
});

test('identity keys survive URL scheme, www and path changes; repeated businesses are deduped', () => {
  assert.equal(outreachKey({ businessName: 'Example Co', websiteUrl: 'https://www.example.com/about' }), outreachKey({ businessName: 'Example Co', websiteUrl: 'http://example.com/another-page' }));
  const result = parseOutreachRows([headers,
    ['Example Co','','Kenosha, WI','https://example.com','','','Website','','','','','','','','','','','Oscar','Not Sent',''],
    ['Example Co','','Kenosha, WI','https://www.example.com/about','','','Website','','','','','','','','','','','Oscar','Not Sent',''],
    ['','','','','','','','','','','','','','','','','','','','partial']]);
  assert.equal(result.prospects.length, 1);
  assert.deepEqual(result.duplicateRows, [3]);
  assert.deepEqual(result.skippedRows, [4]);
});

test('invalid headers, date values and statuses fail visibly instead of corrupting the import', () => {
  assert.throws(() => parseOutreachRows([['Business Name']]), /Missing required Outreach columns/);
  assert.throws(() => parseOutreachRows([headers, ['Business','','','','','','','','','','','','','','','','','Oscar','Sent maybe','']]), /unknown Outreach Status/);
  const result = parseOutreachRows([headers, ['Business','','','','','','','','','','','','','','','','not a date','Other','Not Sent','']]);
  assert.equal(result.prospects[0].date_added, null);
  assert.equal(result.prospects[0].sent_by, null);
});

test('status interpretation keeps Sheet baseline separate and counts resolved outreach as done', () => {
  assert.equal(effectiveOutreachStatus({ outreach_status: null, source_status: 'Emailed' }), 'Emailed');
  assert.equal(effectiveOutreachStatus({ outreach_status: 'DMed', source_status: 'Not Sent' }), 'DMed');
  assert.equal(isOutreachComplete('Not Sent'), false);
  for (const status of outreachStatuses.slice(1)) assert.equal(isOutreachComplete(status), true, status);
});

test('untrusted prospect links are restricted to HTTP(S)', () => {
  assert.equal(safeOutreachUrl('example.com/path'), 'https://example.com/path');
  assert.equal(safeOutreachUrl('https://example.com'), 'https://example.com/');
  assert.equal(safeOutreachUrl('javascript:alert(1)'), null);
  assert.equal(safeOutreachUrl('data:text/html,hello'), null);
});

test('live outreach policies isolate reads and status changes are audited for members only', async t => {
  const db = new PGlite();
  const orgA = '00000000-0000-4000-8000-000000000001';
  const orgB = '00000000-0000-4000-8000-000000000002';
  const member = '00000000-0000-4000-8000-000000000011';
  const outsider = '00000000-0000-4000-8000-000000000012';
  const viewer = '00000000-0000-4000-8000-000000000013';
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    insert into auth.users values ('${member}'),('${outsider}'),('${viewer}');`);
  for (const file of ['workspace.sql','dashboard.sql','outreach-pipeline.sql']) await db.exec(await readFile(new URL(`../supabase/schemas/${file}`, import.meta.url), 'utf8'));
  await db.exec(`insert into public.oj_organizations(id,name) values ('${orgA}','OJ'),('${orgB}','Other');
    insert into public.oj_memberships(organization_id,user_id,role,display_name) values
    ('${orgA}','${member}','member','Oscar'),('${orgA}','${viewer}','viewer','Viewer'),('${orgB}','${outsider}','member','Other');
    insert into public.oj_outreach_prospects(organization_id,source_key,source_row,business_name,source_status)
    values ('${orgA}','${'a'.repeat(64)}',2,'Business A','Not Sent'),('${orgB}','${'b'.repeat(64)}',2,'Business B','Not Sent');`);
  const as = async (id: string, role = 'authenticated') => { await db.exec(`reset role; set request.jwt.claim.sub = '${id}'; set role ${role};`); };
  const id = (await db.query<{ id: string }>(`select id from public.oj_outreach_prospects where organization_id='${orgA}'`)).rows[0].id;

  await t.test('member sees only prospects in their workspace and can change status', async () => {
    await as(member);
    assert.deepEqual((await db.query<{ business_name: string }>('select business_name from public.oj_outreach_prospects')).rows.map(r => r.business_name), ['Business A']);
    assert.equal((await db.query<{ status: string }>(`select public.oj_set_outreach_status('${orgA}','${id}','Emailed') as status`)).rows[0].status, 'Emailed');
    assert.equal((await db.query('select id from public.oj_outreach_activity')).rows.length, 1);
    assert.equal((await db.query<{ previous_status: string; new_status: string }>('select previous_status,new_status from public.oj_outreach_activity')).rows[0].previous_status, 'Not Sent');
  });
  await t.test('viewer can read but cannot change outreach and an outsider cannot see it', async () => {
    await as(viewer);
    assert.equal((await db.query('select id from public.oj_outreach_prospects')).rows.length, 1);
    await assert.rejects(() => db.query(`select public.oj_set_outreach_status('${orgA}','${id}','DMed')`));
    await as(outsider);
    assert.deepEqual((await db.query<{ business_name: string }>('select business_name from public.oj_outreach_prospects')).rows.map(r => r.business_name), ['Business B']);
    await assert.rejects(() => db.query(`select public.oj_set_outreach_status('${orgA}','${id}','DMed')`));
  });
  await t.test('sheet upserts update source fields but preserve workspace-owned status', async () => {
    await as('', 'service_role');
    await db.exec(`insert into public.oj_outreach_prospects(organization_id,source_key,source_row,business_name,source_status)
      values ('${orgA}','${'a'.repeat(64)}',2,'Business A revised','DMed')
      on conflict(organization_id,source_key) do update set business_name=excluded.business_name,source_status=excluded.source_status`);
    const saved = (await db.query<{ business_name: string; source_status: string; outreach_status: string }>(`select business_name,source_status,outreach_status from public.oj_outreach_prospects where organization_id='${orgA}'`)).rows[0];
    assert.deepEqual(saved, { business_name: 'Business A revised', source_status: 'DMed', outreach_status: 'Emailed' });
    const run = (await db.query<{ id: string }>(`insert into public.oj_outreach_sync_runs(organization_id,status) values ('${orgA}','failed') returning id`)).rows[0];
    const finished = await db.query<{ status: string }>(`update public.oj_outreach_sync_runs set status='success' where id='${run.id}' returning status`);
    assert.equal(finished.rows[0].status, 'success');
  });
  await t.test('anonymous access and invalid status values are denied', async () => {
    await as('', 'anon');
    await assert.rejects(() => db.query('select id from public.oj_outreach_prospects'));
    await assert.rejects(() => db.query(`select public.oj_set_outreach_status('${orgA}','${id}','Sent maybe')`));
  });
  await db.close();
});

