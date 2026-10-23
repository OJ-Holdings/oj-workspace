import test from 'node:test';
import assert from 'node:assert/strict';
import type { FinanceEntry } from '../src/lib/dashboard';
import { matchesMoneyWorkFocus, moneyWorkCounts, moneyWorkDetails, moneyWorkFocuses, moneyWorkLabels, sortMoneyWorkEntries } from '../src/lib/money-workflow';

const make = (id: string, kind: 'revenue' | 'cost', auto?: string, occurred_on = '2026-10-23'): FinanceEntry =>
  ({ id, venture: 'exterior', kind, auto, occurred_on, amount: 0, category: 'Test', note: '' });

test('money queues preserve direct-vs-source distinctions without double counting', () => {
  const rows = [make('a', 'revenue'), make('b', 'cost'), make('c', 'revenue', 'Exterior Care job'), make('d', 'cost', 'Exterior Care job'), make('e', 'revenue', 'Shopify')];
  assert.deepEqual(moneyWorkCounts(rows), { all: 5, in: 3, out: 2, manual: 2, source: 3 });
  assert.equal(moneyWorkFocuses.every(f => moneyWorkDetails[f] && moneyWorkLabels[f]), true);
  assert.equal(rows.length, 5);
});

test('zero is an entered figure, never assumed missing; sourced date is not bank settlement', () => {
  const zero = make('zero', 'cost', 'Exterior Care job');
  zero.amount = 0;
  zero.dateBasis = 'updated-estimate';
  assert.equal(matchesMoneyWorkFocus(zero, 'out'), true);
  assert.equal(matchesMoneyWorkFocus(zero, 'source'), true);
  assert.equal(matchesMoneyWorkFocus(zero, 'manual'), false);
  assert.equal(zero.dateBasis, 'updated-estimate');
  assert.equal(matchesMoneyWorkFocus(make('manual', 'revenue'), 'source'), false);
});

test('sort uses recorded source dates with stable tie breaks and never mutates rows', () => {
  const rows = [make('z', 'cost', undefined, '2026-09-30'), make('b', 'revenue'), make('a', 'cost'), make('c', 'revenue', undefined, '2026-10-24')];
  assert.deepEqual(sortMoneyWorkEntries(rows).map(x => x.id), ['c', 'a', 'b', 'z']);
  assert.deepEqual(rows.map(x => x.id), ['z', 'b', 'a', 'c']);
});
