import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ORG = '00000000-0000-4000-8000-000000000001', OTHER = '00000000-0000-4000-8000-000000000002';
const OWNER = '00000000-0000-4000-8000-000000000011', MEMBER = '00000000-0000-4000-8000-000000000012', VIEWER = '00000000-0000-4000-8000-000000000013', OUTSIDER = '00000000-0000-4000-8000-000000000014';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${OWNER}'),('${MEMBER}'),('${VIEWER}'),('${OUTSIDER}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../docs/db-change-proposals/money-core/ledger-core.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${ORG}','OJ'),('${OTHER}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values
      ('${ORG}','${OWNER}','owner','Oscar'),('${ORG}','${MEMBER}','member','Jacob'),('${ORG}','${VIEWER}','viewer','Viewer'),('${OTHER}','${OUTSIDER}','owner','Other');`);
  const as = async (user: string, role = 'authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${user}'; set role ${role};`);
  return { db, as };
}
type Db = Awaited<ReturnType<typeof setup>>['db'];
const account = async (db: Db, code: string) => (await db.query<{ id: string }>(`select id from oj_accounts where organization_id='${ORG}' and code='${code}'`)).rows[0].id;
const line = (account_id: string, debit_cents: number, credit_cents: number, division = 'exterior') => ({ account_id, division, debit_cents, credit_cents, memo: '' });
const post = (db: Db, lines: unknown[], over: { date?: string; key?: string | null; org?: string } = {}) =>
  db.query<{ id: string }>(`select public.oj_post_journal('${over.org ?? ORG}', '${over.date ?? '2026-10-27'}', 'test', 'manual', null, ${over.key ? `'${over.key}'` : 'null'}, $1::jsonb) as id`, [JSON.stringify(lines)]);

test('ledger: chart seeding, roles, balance rules, append-only, idempotency, reversal, period lock, tenancy', async t => {
  const { db, as } = await setup();

  await t.test('only an owner can seed the chart, once', async () => {
    await as(MEMBER); await assert.rejects(() => db.query(`select public.oj_seed_chart('${ORG}')`), /Owner access required/);
    await as(VIEWER); await assert.rejects(() => db.query(`select public.oj_seed_chart('${ORG}')`), /Owner access required/);
    await as(OWNER);
    const n = (await db.query<{ oj_seed_chart: number }>(`select public.oj_seed_chart('${ORG}')`)).rows[0].oj_seed_chart;
    assert.ok(n >= 30);
    await assert.rejects(() => db.query(`select public.oj_seed_chart('${ORG}')`), /already has a chart/);
  });

  let cash: string, revenue: string, ar: string, fuel: string;
  await t.test('read access follows membership; outsiders and anonymous see nothing', async () => {
    await as(OWNER); cash = await account(db, '1000'); revenue = await account(db, '4000'); ar = await account(db, '1100'); fuel = await account(db, '5020');
    await as(VIEWER); assert.ok((await db.query('select * from oj_accounts')).rows.length >= 30);
    await as(OUTSIDER); assert.equal((await db.query('select * from oj_accounts')).rows.length, 0);
    await as('', 'anon'); await assert.rejects(() => db.query('select * from oj_accounts'));
  });

  await t.test('members and owners post balanced entries; viewers and outsiders cannot', async () => {
    await as(MEMBER);
    const id = (await post(db, [line(cash, 20000, 0), line(revenue, 0, 20000)])).rows[0].id;
    assert.match(id, /^[0-9a-f-]{36}$/);
    await as(VIEWER); await assert.rejects(() => post(db, [line(cash, 100, 0), line(revenue, 0, 100)]), /Workspace member access required/);
    await as(OUTSIDER); await assert.rejects(() => post(db, [line(cash, 100, 0), line(revenue, 0, 100)]), /Workspace member access required/);
  });

  await t.test('unbalanced, one-sided, zero, negative, single-line and over-long entries are refused', async () => {
    await as(OWNER);
    await assert.rejects(() => post(db, [line(cash, 100, 0), line(revenue, 0, 90)]), /not balanced/);
    await assert.rejects(() => post(db, [line(cash, 100, 100), line(revenue, 0, 0)]), /positive debit or a positive credit/);
    await assert.rejects(() => post(db, [line(cash, 0, 0), line(revenue, 0, 0)]), /positive debit or a positive credit/);
    await assert.rejects(() => post(db, [line(cash, -100, 0), line(revenue, 0, -100)]), /positive debit or a positive credit/);
    await assert.rejects(() => post(db, [line(cash, 100, 0)]), /between 2 and 60 lines/);
    await assert.rejects(() => post(db, Array.from({ length: 61 }, (_, i) => line(i % 2 ? cash : revenue, i % 2 ? 1 : 0, i % 2 ? 0 : 1))), /between 2 and 60 lines/);
    await assert.rejects(() => post(db, [line(cash, 100, 0, 'bogus'), line(revenue, 0, 100)]));
  });

  await t.test('accounts must exist in this company and be active', async () => {
    await as(OWNER);
    await assert.rejects(() => post(db, [line('00000000-0000-4000-8000-0000000000ff', 100, 0), line(revenue, 0, 100)]), /Unknown account/);
    await db.exec(`reset role; update oj_accounts set active=false where id='${fuel}'; set request.jwt.claim.sub='${OWNER}'; set role authenticated;`);
    await assert.rejects(() => post(db, [line(fuel, 100, 0), line(cash, 0, 100)]), /inactive/);
    await db.exec(`reset role; update oj_accounts set active=true where id='${fuel}'; set request.jwt.claim.sub='${OWNER}'; set role authenticated;`);
    await assert.rejects(() => post(db, [line(cash, 100, 0), line(revenue, 0, 100)], { org: OTHER }), /Workspace member access required/);
  });

  await t.test('nothing can be written directly, even by an owner', async () => {
    await as(OWNER);
    await assert.rejects(() => db.exec(`insert into oj_journal_entries(organization_id,entry_date) values ('${ORG}','2026-10-27')`), /permission denied/);
    await assert.rejects(() => db.exec(`insert into oj_accounts(organization_id,code,name,type) values ('${ORG}','9999','x','asset')`), /permission denied/);
    await assert.rejects(() => db.exec(`update oj_accounts set name='x'`), /permission denied/);
    await assert.rejects(() => db.exec(`delete from oj_journal_lines`), /permission denied/);
  });

  await t.test('posted entries and lines are append-only even for the database owner', async () => {
    await db.exec('reset role');
    await assert.rejects(() => db.exec(`update oj_journal_entries set memo='tampered'`), /append-only/);
    await assert.rejects(() => db.exec(`delete from oj_journal_entries`), /append-only/);
    await assert.rejects(() => db.exec(`update oj_journal_lines set debit_cents=1 where debit_cents>0`), /append-only/);
    await assert.rejects(() => db.exec(`delete from oj_journal_lines`), /append-only/);
  });

  await t.test('the commit-time balance check catches entries that bypass the posting function', async () => {
    await db.exec('reset role');
    const entry = '00000000-0000-4000-8000-0000000000e1';
    await assert.rejects(() => db.exec(`begin; insert into oj_journal_entries(id,organization_id,entry_date,created_by) values ('${entry}','${ORG}','2026-10-27','${OWNER}');
      insert into oj_journal_lines(organization_id,entry_id,account_id,division,debit_cents) values ('${ORG}','${entry}','${cash}','exterior',500);
      insert into oj_journal_lines(organization_id,entry_id,account_id,division,credit_cents) values ('${ORG}','${entry}','${revenue}','exterior',400); commit;`), /not balanced/);
    await db.exec('rollback');
    await assert.rejects(() => db.exec(`begin; insert into oj_journal_entries(id,organization_id,entry_date,created_by) values ('${entry}','${ORG}','2026-10-27','${OWNER}');
      insert into oj_journal_lines(organization_id,entry_id,account_id,division,debit_cents) values ('${ORG}','${entry}','${cash}','exterior',500); commit;`), /at least two lines/);
    await db.exec('rollback');
    assert.equal((await db.query(`select 1 from oj_journal_entries where id='${entry}'`)).rows.length, 0);
  });

  await t.test('retrying with the same idempotency key returns the original entry and posts nothing twice', async () => {
    await as(OWNER);
    const before = (await db.query<{ n: number }>('select count(*)::int as n from oj_journal_lines')).rows[0].n;
    const first = (await post(db, [line(ar, 7500, 0), line(revenue, 0, 7500)], { key: 'invoice-1001' })).rows[0].id;
    const again = (await post(db, [line(ar, 7500, 0), line(revenue, 0, 7500)], { key: 'invoice-1001' })).rows[0].id;
    assert.equal(again, first);
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from oj_journal_lines')).rows[0].n, before + 2);
  });

  await t.test('a reversal mirrors the entry once, and a reversal cannot be reversed', async () => {
    await as(MEMBER);
    const original = (await post(db, [line(fuel, 4000, 0), line(cash, 0, 4000)], { key: 'fuel-1' })).rows[0].id;
    const rev = (await db.query<{ id: string }>(`select public.oj_reverse_journal('${ORG}','${original}','2026-10-28','Wrong amount','rev-fuel-1') as id`)).rows[0].id;
    const mirrored = (await db.query<{ debit_cents: string; credit_cents: string; account_id: string }>(`select debit_cents,credit_cents,account_id from oj_journal_lines where entry_id='${rev}' order by debit_cents desc`)).rows;
    assert.equal(mirrored.length, 2);
    assert.equal(Number(mirrored[0].debit_cents), 4000); assert.equal(mirrored[0].account_id, cash);
    assert.equal(Number(mirrored[1].credit_cents), 4000); assert.equal(mirrored[1].account_id, fuel);
    const same = (await db.query<{ id: string }>(`select public.oj_reverse_journal('${ORG}','${original}','2026-10-28','Wrong amount','rev-fuel-1') as id`)).rows[0].id;
    assert.equal(same, rev);
    await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}','${original}','2026-10-29','again','rev-fuel-2')`), /already reversed/);
    await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}','${rev}','2026-10-29','undo undo','rev-fuel-3')`), /cannot be reversed/);
    await as(VIEWER); await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}','${original}','2026-10-30',null,null)`), /member access/);
  });

  await t.test('the trial balance nets to zero and reflects postings', async () => {
    await as(VIEWER);
    const rows = (await db.query<{ code: string; debit_cents: string; credit_cents: string }>(`select code,debit_cents,credit_cents from oj_trial_balance('${ORG}','2026-12-31')`)).rows;
    const debit = rows.reduce((s, r) => s + Number(r.debit_cents), 0), credit = rows.reduce((s, r) => s + Number(r.credit_cents), 0);
    assert.equal(debit, credit);
    const cashRow = rows.find(r => r.code === '1000')!;
    assert.equal(Number(cashRow.debit_cents), 20000 + 4000); // sale plus the reversal of the fuel entry
    assert.equal(Number(cashRow.credit_cents), 4000); // the fuel payment
    await as(OUTSIDER);
    assert.equal((await db.query(`select * from oj_trial_balance('${ORG}','2026-12-31')`)).rows.filter(r => Number((r as { debit_cents: string }).debit_cents) > 0).length, 0);
  });

  await t.test('a locked period refuses postings on or before the lock date, and the lock only moves forward', async () => {
    await as(MEMBER); await assert.rejects(() => db.query(`select public.oj_lock_period('${ORG}','2026-10-31')`), /Owner access required/);
    await as(OWNER);
    await db.query(`select public.oj_lock_period('${ORG}','2026-10-31')`);
    await assert.rejects(() => post(db, [line(cash, 100, 0), line(revenue, 0, 100)], { date: '2026-10-31' }), /locked through/);
    await assert.rejects(() => post(db, [line(cash, 100, 0), line(revenue, 0, 100)], { date: '2026-10-01' }), /locked through/);
    await post(db, [line(cash, 100, 0), line(revenue, 0, 100)], { date: '2026-11-01' });
    await assert.rejects(() => db.query(`select public.oj_lock_period('${ORG}','2026-10-15')`), /cannot be reopened/);
    await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}', (select id from oj_journal_entries where idempotency_key='invoice-1001'), '2026-10-20', null, null)`), /locked through/);
  });

  await t.test('another company sees none of this company\'s ledger', async () => {
    await as(OUTSIDER);
    for (const table of ['oj_journal_entries', 'oj_journal_lines', 'oj_ledger_locks']) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0, table);
  });
});
