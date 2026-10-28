import assert from 'node:assert/strict';
import test from 'node:test';
import { bankDifference, bankLines, isBooked, ledgerForBankAccount, mapBankTransactions, pairedOutgoing, suggestCategory, type BankTx } from '../src/lib/bank-books';

const tx = (o: Partial<BankTx>): BankTx => ({ id: 't', accountId: 'a1', accountName: '03 Operations', cents: -1000, status: 'sent', kind: 'other', counterparty: '', note: '', day: '2026-10-20', ...o });
const accounts = [{ id: 'a1', name: '03 Operations & Growth' }, { id: 'a2', name: '01 Revenue Clearing' }, { id: 'a3', name: 'OJ EC TRUCK FUND' }];

test('mercury rows become signed cents, and rows without an id, amount or date are dropped', () => {
  const body = { transactions: [
    { id: 'x1', accountId: 'a1', amount: -84.1, status: 'sent', kind: 'debitCardTransaction', counterpartyName: 'Menards', postedAt: '2026-10-20T14:00:00Z' },
    { id: 'x2', accountId: 'a1', amount: '250.00', status: 'pending', createdAt: '2026-10-21T01:00:00Z' },
    { id: 'x3', accountId: 'a1', amount: 'n/a', createdAt: '2026-10-21T01:00:00Z' },
    { accountId: 'a1', amount: 5, createdAt: '2026-10-21T01:00:00Z' },
    { id: 'x5', accountId: 'a1', amount: 5 },
  ] };
  const out = mapBankTransactions(body, new Map([['a1', 'Ops']]));
  assert.deepEqual(out.map(t => [t.id, t.cents, t.day, t.accountName, t.counterparty]), [['x1', -8410, '2026-10-20', 'Ops', 'Menards'], ['x2', 25000, '2026-10-21', 'Ops', '']]);
  assert.deepEqual(out.map(isBooked), [true, false], 'a pending item is not booked');
  assert.deepEqual(mapBankTransactions(null, new Map()), []);
});

test('bank accounts map to ledger accounts by name, essentials accounts keep their own division, unknown ones need a choice', () => {
  assert.deepEqual(ledgerForBankAccount('01 Revenue Clearing'), { code: '1010', division: 'exterior' });
  assert.deepEqual(ledgerForBankAccount('03 Operations & Growth'), { code: '1000', division: 'exterior' });
  assert.deepEqual(ledgerForBankAccount('02 Tax Reserve'), { code: '1020', division: 'exterior' });
  assert.deepEqual(ledgerForBankAccount('OJ EC TRUCK FUND'), { code: '1030', division: 'exterior' });
  assert.deepEqual(ledgerForBankAccount('01 ES Clearing'), { code: '1010', division: 'essentials' });
  assert.deepEqual(ledgerForBankAccount('Mercury Credit'), { code: '2000', division: 'exterior' });
  assert.equal(ledgerForBankAccount('04 Owner Distribution'), null);
});

test('suggestions follow what the bank says, money direction matters, and a transfer points at the other account', () => {
  assert.equal(suggestCategory(tx({ counterparty: 'GOOGLE *ADS 123' }), accounts)?.code, '6000');
  assert.equal(suggestCategory(tx({ counterparty: 'THE HOME DEPOT #4' }), accounts)?.code, '5000');
  assert.equal(suggestCategory(tx({ counterparty: 'KWIK TRIP 421' }), accounts)?.code, '5020');
  assert.equal(suggestCategory(tx({ counterparty: 'Shopify', cents: 4200 }), accounts)?.code, '4200', 'a Shopify payout in is sales');
  assert.equal(suggestCategory(tx({ counterparty: 'Shopify', cents: -2900 }), accounts)?.code, '6110', 'a Shopify bill out is software');
  assert.equal(suggestCategory(tx({ counterparty: 'Random Person', cents: 50000 }), accounts), null, 'money in from a person is never guessed');
  const move = suggestCategory(tx({ kind: 'internalTransfer', counterparty: 'OJ EC TRUCK FUND', cents: -50000 }), accounts);
  assert.equal(move?.code, '1030');
});

test('a move between our own accounts is booked once: the outgoing leg is hidden when its incoming twin is present', () => {
  const out = tx({ id: 'o', accountId: 'a2', kind: 'internalTransfer', cents: -50000, day: '2026-10-20' });
  const inn = tx({ id: 'i', accountId: 'a3', kind: 'internalTransfer', cents: 50000, day: '2026-10-21' });
  const lone = tx({ id: 'l', accountId: 'a2', kind: 'internalTransfer', cents: -9900, day: '2026-10-20' });
  assert.deepEqual([...pairedOutgoing([out, inn, lone])], ['o']);
  assert.deepEqual([...pairedOutgoing([out, { ...inn, day: '2026-11-20' }])], [], 'too far apart to be the same move');
});

test('journal lines balance and run the right way for money in and out', () => {
  const out = bankLines(tx({ cents: -8410 }), 'BANK', 'EXP', 'exterior', 'Menards');
  assert.deepEqual(out.map(l => [l.account_id, l.debit_cents, l.credit_cents]), [['EXP', 8410, 0], ['BANK', 0, 8410]]);
  const inn = bankLines(tx({ cents: 123000 }), 'BANK', 'INC', 'exterior', 'Waukegan');
  assert.deepEqual(inn.map(l => [l.account_id, l.debit_cents, l.credit_cents]), [['BANK', 123000, 0], ['INC', 0, 123000]]);
  for (const lines of [out, inn]) assert.equal(lines.reduce((s, l) => s + l.debit_cents - l.credit_cents, 0), 0);
});

test('bank versus books: assets count debits less credits, a credit card the other way, and the gap is the bank minus the books', () => {
  assert.deepEqual(bankDifference(200000, 150000, 10000, false), { books: 140000, difference: 60000 });
  assert.deepEqual(bankDifference(20000, 5000, 25000, true), { books: 20000, difference: 0 });
});
