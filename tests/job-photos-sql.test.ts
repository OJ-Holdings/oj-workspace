import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
const job = '00000000-0000-4000-8000-0000000000aa';
const file = (o = org, j = job, n = 'a1b2c3d4-0000-4000-8000-000000000001.jpg') => `${o}/${j}/${n}`;

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');
    -- A minimal stand-in for Supabase Storage, so the real storage policies in the script are exercised, not skipped.
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    grant usage on schema storage to authenticated; grant select, insert, delete on storage.objects to authenticated; grant execute on function storage.foldername(text) to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');`);
  await db.exec(await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-job-photos.sql', import.meta.url), 'utf8'));
  return db;
}
const as = async (db: PGlite, uid: string) => { await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`); };
const n = async (db: PGlite, table: string) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;
const addRow = (o: string, j: string, path: string, kind = 'before') => `insert into oj_job_photos(organization_id,lead_id,storage_path,kind) values ('${o}','${j}','${path}','${kind}')`;

test('the bucket is private, and a member adds a photo row; a path outside the job or workspace is refused', async () => {
  const db = await setup();
  assert.deepEqual((await db.query<{ public: boolean; file_size_limit: number }>(`select public, file_size_limit from storage.buckets where id = 'oj-job-photos'`)).rows[0], { public: false, file_size_limit: 10485760 });
  await as(db, owner);
  await db.exec(addRow(org, job, file()));
  assert.equal(await n(db, 'oj_job_photos'), 1);
  await assert.rejects(() => db.exec(addRow(org, job, file(other))), /check/);
  await assert.rejects(() => db.exec(addRow(org, job, file(org, '00000000-0000-4000-8000-0000000000bb'))), /check/);
  await assert.rejects(() => db.exec(addRow(org, job, file(org, job, 'a1b2c3d4-0000-4000-8000-000000000001.jpg'))), /unique|duplicate/);
  await assert.rejects(() => db.exec(`insert into oj_job_photos(organization_id,lead_id,storage_path,kind) values ('${org}','${job}','${file(org, job, 'b1b2c3d4-0000-4000-8000-000000000002.jpg')}','selfie')`));
});

test('only kind and caption can be edited; a member can remove a photo row', async () => {
  const db = await setup();
  await as(db, owner);
  await db.exec(addRow(org, job, file()));
  await db.exec(`update oj_job_photos set kind = 'after', caption = 'Driveway, finished'`);
  assert.deepEqual((await db.query<{ kind: string; caption: string }>('select kind, caption from oj_job_photos')).rows[0], { kind: 'after', caption: 'Driveway, finished' });
  await assert.rejects(() => db.exec(`update oj_job_photos set storage_path = '${file(org, job, 'x.jpg')}'`));
  await assert.rejects(() => db.exec(`update oj_job_photos set organization_id = '${other}'`));
  await db.exec('delete from oj_job_photos');
  assert.equal(await n(db, 'oj_job_photos'), 0);
});

test('a viewer cannot see or add photos and another workspace sees nothing; nobody can add as someone else', async () => {
  const db = await setup();
  await as(db, owner);
  await db.exec(addRow(org, job, file()));
  await assert.rejects(() => db.exec(`insert into oj_job_photos(organization_id,lead_id,storage_path,created_by) values ('${org}','${job}','${file(org, job, 'c1b2c3d4-0000-4000-8000-000000000003.jpg')}','${viewer}')`));
  await as(db, viewer);
  assert.equal(await n(db, 'oj_job_photos'), 0);
  await assert.rejects(() => db.exec(addRow(org, job, file(org, job, 'd1b2c3d4-0000-4000-8000-000000000004.jpg'))));
  await as(db, stranger);
  assert.equal(await n(db, 'oj_job_photos'), 0);
  await assert.rejects(() => db.exec(addRow(org, job, file(org, job, 'e1b2c3d4-0000-4000-8000-000000000005.jpg'))));
});

test('storage: members read, add and remove files under their own workspace folder only', async () => {
  const db = await setup();
  const put = (who: string, path: string, bucket = 'oj-job-photos') => `insert into storage.objects(bucket_id,name) values ('${bucket}','${path}')`;
  await as(db, owner);
  await db.exec(put(owner, file()));
  assert.equal(await n(db, 'storage.objects'), 1);
  await assert.rejects(() => db.exec(put(owner, file(other))));
  await assert.rejects(() => db.exec(put(owner, file(), 'some-other-bucket')));
  await assert.rejects(() => db.exec(put(owner, 'not-a-uuid/job/x.jpg')));
  await assert.rejects(() => db.exec(put(owner, 'loose-file.jpg')));
  await as(db, stranger);
  assert.equal(await n(db, 'storage.objects'), 0);
  await db.exec(put(stranger, file(other)));
  assert.equal(await n(db, 'storage.objects'), 1);
  await db.exec(`delete from storage.objects where bucket_id = 'oj-job-photos'`);
  await as(db, owner);
  assert.equal(await n(db, 'storage.objects'), 1);
  await as(db, viewer);
  assert.equal(await n(db, 'storage.objects'), 0);
  await assert.rejects(() => db.exec(put(viewer, file(org, job, 'f1b2c3d4-0000-4000-8000-000000000006.jpg'))));
  await db.exec(`delete from storage.objects`);
  await as(db, owner);
  assert.equal(await n(db, 'storage.objects'), 1);
});

test('the script is one transaction and refuses a second run', async () => {
  const db = await setup();
  await db.exec('reset role');
  const script = await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-job-photos.sql', import.meta.url), 'utf8');
  await assert.rejects(() => db.exec(script), /already exists/);
});
