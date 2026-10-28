import assert from 'node:assert/strict';
import test from 'node:test';
import { portfolio } from '../src/lib/portfolio';
import type { FinanceEntry } from '../src/lib/dashboard';
import type { VentureId } from '../src/lib/ventures';

const e = (venture: VentureId, kind: 'revenue' | 'cost', amount: number, occurred_on: string): FinanceEntry => ({ id: venture + kind + amount + occurred_on, venture, kind, amount, occurred_on, category: '', note: '' });

test('month and year figures, margin and share per business', () => {
  const p = portfolio([
    e('exterior', 'revenue', 800, '2026-10-05'), e('exterior', 'revenue', 200, '2026-06-05'), e('exterior', 'cost', 250, '2026-10-06'),
    e('solutions', 'revenue', 1000, '2026-10-01'), e('essentials', 'revenue', 999, '2025-12-01'),
  ], '2026-10-27');
  assert.deepEqual([p.exterior.monthIn, p.exterior.monthOut, p.exterior.yearIn, p.exterior.yearOut], [800, 250, 1000, 250]);
  assert.equal(p.exterior.margin, 0.75);
  assert.equal(p.exterior.share, 0.5);
  assert.equal(p.solutions.share, 0.5);
  assert.equal(p.essentials.yearIn, 0);
});

test('no costs entered means no margin, and nothing in means no share', () => {
  const p = portfolio([e('solutions', 'revenue', 500, '2026-10-01')], '2026-10-27');
  assert.equal(p.solutions.margin, null);
  assert.equal(p.content.share, 0);
  const none = portfolio([], '2026-10-27');
  assert.equal(none.exterior.share, null);
});
