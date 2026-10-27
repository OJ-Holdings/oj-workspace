import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, balanceCents, dollarsToCents, draftTotals, daysOverdue, dueFromTerms, isMissingTable, lineAmountCents, sortInvoices, summariseInvoices, type Invoice } from '../src/lib/invoices';

const inv = (over: Partial<Invoice>): Invoice => ({ id: over.number ?? 'x', number: 'INV-2026-0001', division: 'exterior', customer_name: 'A', customer_email: null, bill_to: '', status: 'open', issue_date: '2026-10-01', due_date: '2026-10-31', terms: 'Net 30', notes: '', subtotal_cents: 100000, tax_cents: 0, total_cents: 100000, paid_cents: 0, created_at: '2026-10-01T00:00:00Z', ...over });

test('typed dollars become whole cents and bad input is refused', () => {
  assert.equal(dollarsToCents('1,230.50'), 123050);
  assert.equal(dollarsToCents('$99'), 9900);
  assert.equal(dollarsToCents(0.1 + 0.2), 30);
  for (const bad of ['', 'abc', '0', '-5', '1e12']) assert.equal(dollarsToCents(bad), null, bad);
});

test('line and invoice totals round per line like the database does', () => {
  assert.equal(lineAmountCents(2.5, 3333), 8333); // 8332.5 rounds half up
  assert.deepEqual(draftTotals([{ quantity: 1, unit_price_cents: 20000 }, { quantity: 2.5, unit_price_cents: 3333 }]), { subtotal_cents: 28333, tax_cents: 0, total_cents: 28333 });
});

test('due dates follow the terms, across month and year ends', () => {
  assert.equal(dueFromTerms('2026-10-27', 30), '2026-11-26');
  assert.equal(dueFromTerms('2026-12-20', 15), '2027-01-04');
  assert.equal(addDays('2026-10-27', 0), '2026-10-27');
});

test('balances and overdue days only apply to open invoices', () => {
  assert.equal(balanceCents(inv({ paid_cents: 40000 })), 60000);
  assert.equal(balanceCents(inv({ status: 'paid', paid_cents: 100000 })), 0);
  assert.equal(balanceCents(inv({ status: 'void' })), 0);
  assert.equal(daysOverdue(inv({}), '2026-10-30'), 0);
  assert.equal(daysOverdue(inv({}), '2026-11-05'), 5);
  assert.equal(daysOverdue(inv({ status: 'paid' }), '2026-12-01'), 0);
});

test('summary counts open, overdue and this month issued, ignoring voids', () => {
  const list = [
    inv({ number: 'A', total_cents: 100000, paid_cents: 25000, due_date: '2026-10-20' }),
    inv({ number: 'B', total_cents: 50000, due_date: '2026-11-30', issue_date: '2026-11-02' }),
    inv({ number: 'C', status: 'paid', total_cents: 70000, paid_cents: 70000, issue_date: '2026-11-03' }),
    inv({ number: 'D', status: 'void', total_cents: 99999, issue_date: '2026-11-04' }),
  ];
  const s = summariseInvoices(list, '2026-11-10');
  assert.equal(s.openCount, 2);
  assert.equal(s.openCents, 75000 + 50000);
  assert.equal(s.overdueCount, 1);
  assert.equal(s.overdueCents, 75000);
  assert.equal(s.issuedThisMonthCents, 50000 + 70000);
});

test('list order is open first, then paid, then void, newest first within each', () => {
  const list = sortInvoices([inv({ number: 'P', status: 'paid' }), inv({ number: 'V', status: 'void' }), inv({ number: 'O1', issue_date: '2026-09-01' }), inv({ number: 'O2', issue_date: '2026-10-01' })]);
  assert.deepEqual(list.map(i => i.number), ['O2', 'O1', 'P', 'V']);
});

test('a missing-table error is recognised so the screen can say setup is needed', () => {
  assert.equal(isMissingTable({ code: '42P01' }), true);
  assert.equal(isMissingTable({ code: 'PGRST205', message: 'Could not find the table public.oj_invoices in the schema cache' }), true);
  assert.equal(isMissingTable({ message: 'relation "oj_invoices" does not exist' }), true);
  assert.equal(isMissingTable({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingTable(null), false);
});
