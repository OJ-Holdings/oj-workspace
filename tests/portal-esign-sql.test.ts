import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
const token = () => randomBytes(32).toString('base64url');
const digest = (t: string) => createHash('sha256').update(t).digest('hex');
const soon = () => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');`);
  await db.exec(await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-proposals.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-portal-esign.sql', import.meta.url), 'utf8'));
  return db;
}
const as = async (db: PGlite, who: string | 'anon') => { await db.exec(who === 'anon' ? `reset role; set request.jwt.claim.sub=''; set role anon;` : `reset role; set request.jwt.claim.sub='${who}'; set role authenticated;`); };

/** A sent proposal with two payable lines and one optional add-on, and a live link. Returns the token and ids. */
async function shared(db: PGlite) {
  await as(db, owner);
  const lines = `'[{"description":"Facility A","quantity":1,"unit_price_cents":95000},{"description":"Facility B","quantity":1,"unit_price_cents":195000},{"description":"Semiannual maintenance","quantity":1,"unit_price_cents":235000,"optional":true}]'::jsonb`;
  const id = (await db.query<{ id: string }>(`select public.oj_create_proposal('${org}', '{"name":"American Roller","address":"Union Grove, WI","lead_id":null}'::jsonb, 'exterior', '${soon()}', 'Net 30', 'Terms', 'Exclusions', 'Internal-looking note', 15000, ${lines}) as id`)).rows[0].id;
  await db.query(`select public.oj_set_proposal_status('${org}', '${id}', 'sent', current_date, '')`);
  const t = token();
  const link = (await db.query<{ id: string }>(`select public.oj_create_portal_link('${org}', '${id}', '${digest(t)}', 30) as id`)).rows[0].id;
  const optional = (await db.query<{ id: string }>(`select id from oj_proposal_lines where proposal_id = '${id}' and optional`)).rows[0].id;
  return { id, t, link, optional };
}

test('only a sent proposal can be shared, by a member, and the token itself is never stored', async () => {
  const db = await setup();
  await as(db, owner);
  const draft = (await db.query<{ id: string }>(`select public.oj_create_proposal('${org}', '{"name":"X"}'::jsonb, 'exterior', '${soon()}', '', '', '', '', 0, '[{"description":"A","quantity":1,"unit_price_cents":1000}]'::jsonb) as id`)).rows[0].id;
  await assert.rejects(() => db.query(`select public.oj_create_portal_link('${org}', '${draft}', '${digest(token())}', 30)`), /sent proposal/);
  const s = await shared(db);
  const stored = (await db.query<{ token_hash: string }>('select token_hash from oj_portal_links')).rows[0].token_hash;
  assert.equal(stored, digest(s.t));
  assert.notEqual(stored, s.t);
  await assert.rejects(() => db.query(`select public.oj_create_portal_link('${org}', '${s.id}', 'not-a-hash', 30)`), /Invalid link/);
  await as(db, viewer);
  await assert.rejects(() => db.query(`select public.oj_create_portal_link('${org}', '${s.id}', '${digest(token())}', 30)`), /member access/);
  await as(db, stranger);
  await assert.rejects(() => db.query(`select public.oj_create_portal_link('${other}', '${s.id}', '${digest(token())}', 30)`), /not found/);
  await assert.rejects(() => db.query(`select public.oj_create_portal_link('${org}', '${s.id}', '${digest(token())}', 30)`), /member access/);
});

test('the public sees only the customer-facing proposal, with the right token', async () => {
  const db = await setup();
  const s = await shared(db);
  await as(db, 'anon');
  const p = (await db.query<{ p: Record<string, unknown> }>(`select public.oj_portal_proposal('${s.t}') as p`)).rows[0].p;
  assert.equal(p.customer_name, 'American Roller');
  assert.equal(p.total_cents, 275000);
  assert.equal((p.lines as unknown[]).length, 3);
  for (const hidden of ['organization_id', 'created_by', 'lead_id', 'id', 'customer_email']) assert.equal(hidden in p, false, `${hidden} must not be exposed`);
  // Anything wrong with the token gives the same empty answer.
  for (const bad of [token(), 'short', '', s.t.slice(0, -1) + (s.t.endsWith('a') ? 'b' : 'a'), s.t + s.t + s.t + s.t + s.t + s.t]) {
    assert.equal((await db.query<{ p: unknown }>(`select public.oj_portal_proposal('${bad}') as p`)).rows[0].p, null);
  }
});

test('the public has no direct access to any table, and cannot call the member functions', async () => {
  const db = await setup();
  const s = await shared(db);
  await as(db, 'anon');
  for (const table of ['oj_proposals', 'oj_proposal_lines', 'oj_portal_links', 'oj_proposal_acceptances', 'oj_customers_x']) {
    await assert.rejects(() => db.query(`select * from ${table}`));
  }
  await assert.rejects(() => db.query(`select public.oj_create_portal_link('${org}', '${s.id}', '${digest(token())}', 30)`));
  await assert.rejects(() => db.query(`select public.oj_revoke_portal_link('${org}', '${s.link}')`));
  await assert.rejects(() => db.query(`select oj_private.live_portal_link('${s.t}')`));
});

test('accepting records the signature, the chosen add-on, the agreed total and a document fingerprint, once', async () => {
  const db = await setup();
  const s = await shared(db);
  await as(db, 'anon');
  const r = (await db.query<{ r: { decision: string; agreed_total_cents: number; document_hash: string } }>(`select public.oj_portal_decide('${s.t}', 'accepted', 'Jane Q. Customer', 'Thanks', array['${s.optional}']::uuid[], '10.0.0.1', '203.0.113.9, 10.0.0.1', 'Mozilla/5.0') as r`)).rows[0].r;
  assert.deepEqual([r.decision, r.agreed_total_cents], ['accepted', 275000 + 235000]);
  assert.match(r.document_hash, /^[a-f0-9]{64}$/);
  const receipt = (await db.query<{ p: { decision: { selected_optional_ids: string[]; agreed_total_cents: number } } }>(`select public.oj_portal_proposal('${s.t}') as p`)).rows[0].p;
  assert.deepEqual(receipt.decision.selected_optional_ids, [s.optional]);
  assert.equal(receipt.decision.agreed_total_cents, r.agreed_total_cents);
  await assert.rejects(() => db.query(`select public.oj_portal_decide('${s.t}', 'accepted', 'Jane Q. Customer', '', null, '10.0.0.1', '203.0.113.9, 10.0.0.1', 'x')`), /already been decided/);
  await as(db, owner);
  const p = (await db.query<{ status: string; decision_note: string }>(`select status, decision_note from oj_proposals where id = '${s.id}'`)).rows[0];
  assert.deepEqual([p.status, p.decision_note], ['accepted', 'Accepted online by Jane Q. Customer: Thanks']);
  const a = (await db.query<{ signer_name: string; ip_address: string; forwarded_for: string; selected_optional_ids: string[]; document_hash: string }>('select signer_name, ip_address, forwarded_for, selected_optional_ids, document_hash from oj_proposal_acceptances')).rows[0];
  // Public callers can supply these fields; never treat their values as identity evidence.
  assert.deepEqual([a.signer_name, a.ip_address, a.forwarded_for, a.selected_optional_ids, a.document_hash], ['Jane Q. Customer', null, null, [s.optional], r.document_hash]);
});

test('declining is recorded without an agreed total; a bad name, an unknown choice or a stranger token changes nothing', async () => {
  const db = await setup();
  const s = await shared(db);
  await as(db, 'anon');
  await assert.rejects(() => db.query(`select public.oj_portal_decide('${s.t}', 'accepted', 'J', '', null, null, null, null)`), /full name/);
  await assert.rejects(() => db.query(`select public.oj_portal_decide('${s.t}', 'maybe', 'Jane Doe', '', null, null, null, null)`), /accept or decline/);
  await assert.rejects(() => db.query(`select public.oj_portal_decide('${token()}', 'accepted', 'Jane Doe', '', null, null, null, null)`), /no longer valid/);
  const r = (await db.query<{ r: { agreed_total_cents: number } }>(`select public.oj_portal_decide('${s.t}', 'declined', 'Jane Doe', 'Went elsewhere', array['${s.optional}']::uuid[], null, null, null) as r`)).rows[0].r;
  assert.equal(r.agreed_total_cents, 0);
  await as(db, owner);
  assert.equal((await db.query<{ s: string }>(`select status as s from oj_proposals where id = '${s.id}'`)).rows[0].s, 'declined');
});

test('a revoked link and an expired link stop working; an expired proposal cannot be accepted', async () => {
  const db = await setup();
  const a = await shared(db);
  await db.query(`select public.oj_revoke_portal_link('${org}', '${a.link}')`);
  await as(db, 'anon');
  assert.equal((await db.query<{ p: unknown }>(`select public.oj_portal_proposal('${a.t}') as p`)).rows[0].p, null);
  await assert.rejects(() => db.query(`select public.oj_portal_decide('${a.t}', 'accepted', 'Jane Doe', '', null, null, null, null)`), /no longer valid/);

  const b = await shared(db);
  await db.exec('reset role');
  await db.exec(`update oj_portal_links set expires_at = now() - interval '1 minute' where id = '${b.link}'`);
  await as(db, 'anon');
  assert.equal((await db.query<{ p: unknown }>(`select public.oj_portal_proposal('${b.t}') as p`)).rows[0].p, null);

  const c = await shared(db);
  await db.exec('reset role');
  await db.exec(`set oj.allow_proposal_change = '1'; update oj_proposals set valid_until = current_date - 1 where id = '${c.id}'; update oj_portal_links set expires_at = now() + interval '1 day' where id = '${c.link}';`);
  await as(db, 'anon');
  await assert.rejects(() => db.query(`select public.oj_portal_decide('${c.t}', 'accepted', 'Jane Doe', '', null, null, null, null)`), /expired/);
});

test('the audit record cannot be changed by anyone, and members can read it but viewers and other workspaces cannot', async () => {
  const db = await setup();
  const s = await shared(db);
  await as(db, 'anon');
  await db.query(`select public.oj_portal_decide('${s.t}', 'accepted', 'Jane Doe', '', null, null, null, null)`);
  await as(db, owner);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_proposal_acceptances')).rows[0].n, 1);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_portal_links')).rows[0].n, 1);
  await assert.rejects(() => db.exec(`update oj_proposal_acceptances set signer_name = 'Someone Else'`));
  await assert.rejects(() => db.exec('delete from oj_proposal_acceptances'));
  await db.exec('reset role');
  await assert.rejects(() => db.exec(`update oj_proposal_acceptances set signer_name = 'Someone Else'`), /permanent record/);
  await assert.rejects(() => db.exec('delete from oj_proposal_acceptances'), /permanent record/);
  await as(db, viewer);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_proposal_acceptances')).rows[0].n, 0);
  await as(db, stranger);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_proposal_acceptances')).rows[0].n, 0);
  assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_portal_links')).rows[0].n, 0);
});

test('sharing again retires the earlier link; stopping sharing and marking the proposal decided by hand close every link', async () => {
  const db = await setup();
  const a = await shared(db);
  const t2 = token();
  await db.query(`select public.oj_create_portal_link('${org}', '${a.id}', '${digest(t2)}', 30)`);
  await as(db, 'anon');
  assert.equal((await db.query<{ p: unknown }>(`select public.oj_portal_proposal('${a.t}') as p`)).rows[0].p, null, 'the earlier link must stop working');
  assert.notEqual((await db.query<{ p: unknown }>(`select public.oj_portal_proposal('${t2}') as p`)).rows[0].p, null);
  await as(db, viewer);
  await assert.rejects(() => db.query(`select public.oj_revoke_proposal_links('${org}', '${a.id}')`), /member access/);
  await as(db, stranger);
  await assert.rejects(() => db.query(`select public.oj_revoke_proposal_links('${org}', '${a.id}')`), /member access/);
  await as(db, owner);
  assert.equal((await db.query<{ n: number }>(`select public.oj_revoke_proposal_links('${org}', '${a.id}') as n`)).rows[0].n, 1);
  await as(db, 'anon');
  assert.equal((await db.query<{ p: unknown }>(`select public.oj_portal_proposal('${t2}') as p`)).rows[0].p, null);

  const b = await shared(db);
  await as(db, owner);
  await db.query(`select public.oj_set_proposal_status('${org}', '${b.id}', 'accepted', current_date, 'By phone')`);
  await as(db, 'anon');
  assert.equal((await db.query<{ p: unknown }>(`select public.oj_portal_proposal('${b.t}') as p`)).rows[0].p, null);
});

test('after the customer signs, their link keeps working only long enough to print, at most a week', async () => {
  const db = await setup();
  const s = await shared(db);
  await as(db, 'anon');
  await db.query(`select public.oj_portal_decide('${s.t}', 'accepted', 'Jane Doe', '', null, null, null, null)`);
  const p = (await db.query<{ p: { decision: { signer_name: string } } }>(`select public.oj_portal_proposal('${s.t}') as p`)).rows[0].p;
  assert.equal(p.decision.signer_name, 'Jane Doe');
  await as(db, owner);
  const days = (await db.query<{ d: number }>(`select extract(epoch from (expires_at - now())) / 86400 as d from oj_portal_links`)).rows[0].d;
  assert.ok(Number(days) <= 7.01, `expected at most 7 days, got ${days}`);
});

test('the script is one transaction and refuses a second run', async () => {
  const db = await setup();
  await db.exec('reset role');
  const script = await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-10-28-portal-esign.sql', import.meta.url), 'utf8');
  await assert.rejects(() => db.exec(script), /already exists/);
});
