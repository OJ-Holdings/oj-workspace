import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Legacy restrictions preserve backend and quote intake while rejecting public access', async t => {
  const db = new PGlite();
  const existing = '00000000-0000-4000-8000-000000000001';
  const newcomer = '00000000-0000-4000-8000-000000000002';
  const tables = ['leads','conversations','bookings','settings','doorknocking_sessions','activity_log'];
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema oj_private;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${existing}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant usage on schema oj_private to authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at=current_timestamp; return new; end $$;`);
  for (const table of [...tables,'quote_requests']) {
    await db.exec(`create table public.${table}(id uuid primary key default gen_random_uuid(),payload text,updated_at timestamptz);
      grant all on public.${table} to anon,authenticated,service_role;
      insert into public.${table}(payload) values('Private fixture');`);
  }
  for (const table of tables.slice(0,4)) await db.exec(`alter table public.${table} enable row level security; create policy "Enable all access to ${table}" on public.${table} for all using(true) with check(true);`);
  await db.exec(`alter table public.quote_requests enable row level security;
    create policy "Allow anon insert" on public.quote_requests for insert to anon with check(true);
    create policy "Allow authenticated read" on public.quote_requests for select to authenticated using(true);`);
  await db.exec(await readFile(new URL('../supabase/schemas/legacy-access.sql',import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${newcomer}');`);
  const as = async (role:string,id='') => db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role ${role};`);
  await t.test('anonymous and newly registered accounts cannot read, edit or truncate legacy records', async () => {
    for (const role of ['anon','authenticated']) {
      await as(role,newcomer);
      for (const table of tables) {
        await assert.rejects(()=>db.query(`select * from public.${table}`));
        await assert.rejects(()=>db.exec(`insert into public.${table}(payload) values('Forged')`));
        await assert.rejects(()=>db.exec(`update public.${table} set payload='Forged'`));
        await assert.rejects(()=>db.exec(`delete from public.${table}`));
        await assert.rejects(()=>db.exec(`truncate public.${table}`));
      }
    }
  });
  await t.test('anonymous quote intake remains insert-only', async () => {
    await as('anon'); await db.exec(`insert into public.quote_requests(payload) values('Website quote')`);
    await assert.rejects(()=>db.query('select * from public.quote_requests'));
    await assert.rejects(()=>db.exec(`update public.quote_requests set payload='Forged'`));
    await assert.rejects(()=>db.exec('truncate public.quote_requests'));
  });
  await t.test('existing readers retain quotes; new signups cannot read them or self-authorize', async () => {
    await as('authenticated',existing); assert.equal((await db.query('select * from public.quote_requests')).rows.length,2);
    await as('authenticated',newcomer); assert.equal((await db.query('select * from public.quote_requests')).rows.length,0);
    await assert.rejects(()=>db.exec(`insert into oj_private.legacy_quote_readers values('${newcomer}')`));
    await assert.rejects(()=>db.exec('truncate public.quote_requests'));
  });
  await t.test('backend role retains legacy reads and writes under enabled RLS', async () => {
    await as('service_role');
    for (const table of [...tables,'quote_requests']) {
      assert.equal((await db.query(`select * from public.${table}`)).rows.length>=1,true);
      const inserted = await db.query<{id:string}>(`insert into public.${table}(payload) values('Backend fixture') returning id`);
      await db.query(`update public.${table} set payload='Backend updated' where id='${inserted.rows[0].id}' returning id`);
      await db.query(`delete from public.${table} where id='${inserted.rows[0].id}' returning id`);
    }
  });
  await db.close();
});
