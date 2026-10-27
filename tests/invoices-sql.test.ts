import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ORG = '00000000-0000-4000-8000-000000000001', OTHER = '00000000-0000-4000-8000-000000000002', EMPTY = '00000000-0000-4000-8000-000000000003';
const OWNER = '00000000-0000-4000-8000-000000000011', MEMBER = '00000000-0000-4000-8000-000000000012', VIEWER = '00000000-0000-4000-8000-000000000013', OUTSIDER = '00000000-0000-4000-8000-000000000014';

async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${OWNER}'),('${MEMBER}'),('${VIEWER}'),('${OUTSIDER}');`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  for (const f of ['ledger-core', 'invoices']) await db.exec(await readFile(new URL(`../docs/db-change-proposals/money-core/${f}.sql`, import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${ORG}','OJ'),('${OTHER}','Other'),('${EMPTY}','No chart');
    insert into oj_memberships(organization_id,user_id,role,display_name) values
      ('${ORG}','${OWNER}','owner','Oscar'),('${ORG}','${MEMBER}','member','Jacob'),('${ORG}','${VIEWER}','viewer','Viewer'),('${OTHER}','${OUTSIDER}','owner','Other'),('${EMPTY}','${OWNER}','owner','Oscar');`);
  const as = async (user: string, role = 'authenticated') => db.exec(`reset role; set request.jwt.claim.sub='${user}'; set role ${role};`);
  return { db, as };
}
type Db = Awaited<ReturnType<typeof setup>>['db'];
const acct = async (db: Db, code: string, org = ORG) => (await db.query<{ id: string }>(`select id from oj_accounts where organization_id='${org}' and code='${code}'`)).rows[0].id;

test('invoices: issue, pay, void, numbering, ledger agreement, immutability and tenancy', async t => {
  const { db, as } = await setup();
  await as(OWNER); await db.query(`select public.oj_seed_chart('${ORG}')`);
  const exteriorIncome = await acct(db, '4000'), commercialIncome = await acct(db, '4010'), cash = await acct(db, '1000');
  const issue = (over: { key?: string | null; issue?: string; due?: string; lines?: unknown[]; division?: string; org?: string; name?: string } = {}) =>
    db.query<{ id: string }>(`select public.oj_issue_invoice('${over.org ?? ORG}', ${over.key ? `'${over.key}'` : 'null'}, $1::jsonb, '${over.division ?? 'exterior'}', '${over.issue ?? '2026-10-27'}', '${over.due ?? '2026-11-26'}', 'Net 30', 'Thanks', $2::jsonb) as id`,
      [JSON.stringify({ name: over.name ?? 'Waukegan Office', email: 'ap@example.com', bill_to: '3900 Foster McGaw Dr', lead_id: null }),
       JSON.stringify(over.lines ?? [{ description: 'Window cleaning, 108 panes', quantity: 1, unit_price_cents: 123000, income_account_id: commercialIncome }])]);
  const invoice = async (id: string) => (await db.query<{ number: string; status: string; total_cents: string; paid_cents: string; issue_entry_id: string }>(`select number,status,total_cents,paid_cents,issue_entry_id from oj_invoices where id='${id}'`)).rows[0];
  const pay = (id: string, cents: number, method = 'ach', key: string | null = null, org = ORG) =>
    db.query<{ id: string }>(`select public.oj_record_payment('${org}','${id}', ${cents}, '${method}', '2026-11-05', 'ref', ${key ? `'${key}'` : 'null'}) as id`);

  let first = '', second = '';
  await t.test('issuing creates the invoice, lines and a balanced ledger entry with sequential numbers', async () => {
    await as(MEMBER);
    first = (await issue({ key: 'job-1' })).rows[0].id;
    const inv = await invoice(first);
    assert.equal(inv.number, 'INV-2026-0001'); assert.equal(inv.status, 'open'); assert.equal(Number(inv.total_cents), 123000);
    const lines = (await db.query<{ debit_cents: string; credit_cents: string; code: string }>(`select l.debit_cents,l.credit_cents,a.code from oj_journal_lines l join oj_accounts a on a.id=l.account_id where l.entry_id='${inv.issue_entry_id}' order by a.code`)).rows;
    assert.deepEqual(lines.map(l => [l.code, Number(l.debit_cents), Number(l.credit_cents)]), [['1100', 123000, 0], ['4010', 0, 123000]]);
    second = (await issue({ lines: [
      { description: 'House wash', quantity: 1, unit_price_cents: 20000, income_account_id: exteriorIncome },
      { description: 'Deck cleaning', quantity: 2.5, unit_price_cents: 3333, income_account_id: exteriorIncome }] })).rows[0].id;
    const inv2 = await invoice(second);
    assert.equal(inv2.number, 'INV-2026-0002');
    assert.equal(Number(inv2.total_cents), 20000 + Math.round(2.5 * 3333));
  });

  await t.test('numbering restarts each year and a retry with the same key returns the same invoice', async () => {
    await as(OWNER);
    assert.equal((await invoice((await issue({ issue: '2027-01-05', due: '2027-02-04' })).rows[0].id)).number, 'INV-2027-0001');
    assert.equal((await issue({ key: 'job-1' })).rows[0].id, first);
    assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from oj_invoices where idempotency_key='job-1'`)).rows[0].n, 1);
  });

  await t.test('viewers and outsiders cannot issue; bad input is refused', async () => {
    await as(VIEWER); await assert.rejects(() => issue(), /Workspace member access required/);
    await as(OUTSIDER); await assert.rejects(() => issue(), /Workspace member access required/);
    await as(OWNER);
    await assert.rejects(() => issue({ lines: [] }), /between 1 and 40 lines/);
    await assert.rejects(() => issue({ due: '2026-10-01' }), /due date/);
    await assert.rejects(() => issue({ lines: [{ description: 'x', quantity: 0, unit_price_cents: 100, income_account_id: exteriorIncome }] }), /positive quantity and price/);
    await assert.rejects(() => issue({ lines: [{ description: 'x', quantity: 1, unit_price_cents: 100, income_account_id: cash }] }), /active income account/);
    await assert.rejects(() => issue({ division: 'bogus' }));
    await assert.rejects(() => issue({ org: EMPTY }), /Chart of accounts is missing/);
  });

  await t.test('a partial payment keeps the invoice open; the full balance marks it paid; overpaying is refused', async () => {
    await as(MEMBER);
    await pay(first, 50000, 'ach', 'p1');
    assert.deepEqual([(await invoice(first)).status, Number((await invoice(first)).paid_cents)], ['open', 50000]);
    await assert.rejects(() => pay(first, 80000), /more than the 73000 cents still owed/);
    await assert.rejects(() => pay(first, 0), /above zero/);
    await assert.rejects(() => pay(first, 100, 'bitcoin'), /payment method|payments_method_check|violates/);
    await pay(first, 73000, 'check', 'p2');
    assert.deepEqual([(await invoice(first)).status, Number((await invoice(first)).paid_cents)], ['paid', 123000]);
    await assert.rejects(() => pay(first, 100), /Only an open invoice/);
  });

  await t.test('payments land in the right deposit account and retries do not double count', async () => {
    const rows = (await db.query<{ code: string; method: string; debit_cents: string }>(`select a.code, p.method, l.debit_cents from oj_payments p join oj_journal_lines l on l.entry_id=p.entry_id join oj_accounts a on a.id=l.account_id where l.debit_cents>0 and p.invoice_id='${first}' order by p.method`)).rows;
    assert.deepEqual(rows.map(r => [r.method, r.code]), [['ach', '1010'], ['check', '1150']]);
    await as(MEMBER);
    const again = (await pay(second, 1000, 'cash', 'p3')).rows[0].id; const same = (await pay(second, 1000, 'cash', 'p3')).rows[0].id;
    assert.equal(again, same);
    assert.equal(Number((await invoice(second)).paid_cents), 1000);
    await as(VIEWER); await assert.rejects(() => pay(second, 100), /Workspace member access required/);
    await as(OUTSIDER); await assert.rejects(() => pay(second, 100, 'ach', null, OTHER), /Invoice not found/);
  });

  await t.test('only an unpaid open invoice can be voided, and voiding reverses the ledger', async () => {
    await as(OWNER);
    const third = (await issue({ name: 'Void me', lines: [{ description: 'Oops', quantity: 1, unit_price_cents: 5000, income_account_id: exteriorIncome }] })).rows[0].id;
    await assert.rejects(() => db.query(`select public.oj_void_invoice('${ORG}','${second}','2026-11-06','nope',null)`), /payments cannot be voided/);
    const entry = (await db.query<{ v: string }>(`select public.oj_void_invoice('${ORG}','${third}','2026-11-06','Wrong customer',null) as v`)).rows[0].v;
    assert.equal((await invoice(third)).status, 'void');
    const again = (await db.query<{ v: string }>(`select public.oj_void_invoice('${ORG}','${third}','2026-11-06','Wrong customer',null) as v`)).rows[0].v;
    assert.equal(again, entry);
    await assert.rejects(() => pay(third, 100), /Only an open invoice/);
  });

  await t.test('receivables in the ledger equal what open invoices still owe', async () => {
    const ar = (await db.query<{ debit_cents: string; credit_cents: string }>(`select debit_cents,credit_cents from oj_trial_balance('${ORG}','2027-12-31') where code='1100'`)).rows[0];
    const owed = (await db.query<{ n: string }>(`select coalesce(sum(total_cents-paid_cents),0)::text as n from oj_invoices where organization_id='${ORG}' and status='open'`)).rows[0].n;
    assert.equal(Number(ar.debit_cents) - Number(ar.credit_cents), Number(owed));
    const all = (await db.query<{ debit_cents: string; credit_cents: string }>(`select debit_cents,credit_cents from oj_trial_balance('${ORG}','2027-12-31')`)).rows;
    assert.equal(all.reduce((s, r) => s + Number(r.debit_cents), 0), all.reduce((s, r) => s + Number(r.credit_cents), 0));
  });

  await t.test('invoices, lines and payments cannot be edited or deleted, directly or by the database owner', async () => {
    await as(OWNER);
    await assert.rejects(() => db.exec(`update oj_invoices set total_cents=1`), /permission denied/);
    await assert.rejects(() => db.exec(`insert into oj_payments(organization_id,invoice_id,amount_cents,method,received_on,entry_id) values ('${ORG}','${first}',1,'cash','2026-11-01','${first}')`), /permission denied/);
    await db.exec('reset role');
    await assert.rejects(() => db.exec(`update oj_invoices set total_cents=1, subtotal_cents=1`), /only through the invoice functions/);
    await assert.rejects(() => db.exec(`delete from oj_invoices`), /append-only/);
    await assert.rejects(() => db.exec(`update oj_invoice_lines set description='x'`), /append-only/);
    await assert.rejects(() => db.exec(`delete from oj_payments`), /append-only/);
  });

  await t.test('invoice ledger entries cannot be forged, borrowed or undone through the general ledger functions', async () => {
    await as(MEMBER);
    const inv = await invoice(second);
    const lines = JSON.stringify([{ account_id: exteriorIncome, division: 'exterior', debit_cents: 100, credit_cents: 0, memo: '' }, { account_id: cash, division: 'exterior', debit_cents: 0, credit_cents: 100, memo: '' }]);
    // reserved entry types and key prefixes belong to the invoice functions
    await assert.rejects(() => db.query(`select public.oj_post_journal('${ORG}','2026-11-06','x','invoice',null,null,$1::jsonb)`, [lines]), /posted by its own function/);
    await assert.rejects(() => db.query(`select public.oj_post_journal('${ORG}','2026-11-06','x','payment',null,null,$1::jsonb)`, [lines]), /posted by its own function/);
    await assert.rejects(() => db.query(`select public.oj_post_journal('${ORG}','2026-11-06','x','manual',null,'pay:p3',$1::jsonb)`, [lines]), /reserved/);
    await assert.rejects(() => db.query(`select public.oj_post_journal('${ORG}','2026-11-06','x','manual',null,'inv-issue:job-1',$1::jsonb)`, [lines]), /reserved/);
    await assert.rejects(() => db.query(`select public.oj_post_journal('${ORG}','2026-11-06','x','manual',null,'inv-void:k',$1::jsonb)`, [lines]), /reserved/);
    await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}','${inv.issue_entry_id}','2026-11-07','x','inv-void:k')`), /reserved/);
    // an invoice or payment entry cannot be reversed behind the invoice's back
    await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}','${inv.issue_entry_id}','2026-11-07','sneaky',null)`), /through the invoice functions/);
    const payEntry = (await db.query<{ entry_id: string }>(`select entry_id from oj_payments where invoice_id='${second}' limit 1`)).rows[0].entry_id;
    await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}','${payEntry}','2026-11-07','sneaky',null)`), /through the invoice functions/);
    // the stored amounts and status are untouched by all of that
    assert.equal((await invoice(second)).status, 'open');
  });

  await t.test('an idempotency key already used by a different entry is refused, not silently reused', async () => {
    await as(OWNER);
    const l = JSON.stringify([{ account_id: exteriorIncome, division: 'exterior', debit_cents: 0, credit_cents: 500, memo: '' }, { account_id: cash, division: 'exterior', debit_cents: 500, credit_cents: 0, memo: '' }]);
    const first = (await db.query<{ id: string }>(`select public.oj_post_journal('${ORG}','2026-11-06','a','manual',null,'dup-key',$1::jsonb) as id`, [l])).rows[0].id;
    assert.equal((await db.query<{ id: string }>(`select public.oj_post_journal('${ORG}','2026-11-06','a','manual',null,'dup-key',$1::jsonb) as id`, [l])).rows[0].id, first);
    await assert.rejects(() => db.query(`select public.oj_post_journal('${ORG}','2026-11-06','a','manual','00000000-0000-4000-8000-0000000000aa','dup-key',$1::jsonb)`, [l]), /already used for a different entry/);
    await assert.rejects(() => db.query(`select public.oj_post_journal('${ORG}','2026-11-06','a','expense',null,'dup-key',$1::jsonb)`, [l]), /already used for a different entry/);
    await assert.rejects(() => db.query(`select public.oj_reverse_journal('${ORG}','${first}','2026-11-07','r','dup-key')`), /already used for a different entry/);
  });

  await t.test('another company sees none of the invoices', async () => {
    await as(OUTSIDER);
    for (const table of ['oj_invoices', 'oj_invoice_lines', 'oj_payments']) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0, table);
    await as(VIEWER);
    assert.ok((await db.query('select * from oj_invoices')).rows.length >= 3);
  });
});
