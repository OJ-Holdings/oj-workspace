import assert from 'node:assert/strict';
import test from 'node:test';
import { seasonPnl } from '../src/lib/season-pnl';
import type { FinanceEntry } from '../src/lib/dashboard';

const e = (occurred_on: string, kind: 'revenue' | 'cost', amount: number, over: Partial<FinanceEntry> = {}): FinanceEntry => ({ id: occurred_on + kind + amount, venture: 'exterior', kind, amount, occurred_on, category: kind === 'cost' ? 'Supplies' : 'Job', note: '', ...over });

test('groups one year by month, oldest first, with net per month and overall', () => {
  const p = seasonPnl([e('2026-06-10', 'revenue', 500), e('2026-05-02', 'revenue', 300), e('2026-05-03', 'cost', 80), e('2025-09-01', 'revenue', 999)], '2026');
  assert.deepEqual(p.months.map(m => [m.month, m.revenue, m.cost, m.net]), [['2026-05', 300, 80, 220], ['2026-06', 500, 0, 500]]);
  assert.equal(p.net, 720);
  assert.deepEqual(p.years, ['2026', '2025']);
});

test('cost categories are ranked and a business filter applies', () => {
  const p = seasonPnl([e('2026-05-01', 'cost', 10, { category: 'Gas' }), e('2026-05-02', 'cost', 90, { category: 'Soap' }), e('2026-05-03', 'cost', 5, { venture: 'solutions', category: 'Ads' })], '2026', 'exterior');
  assert.deepEqual(p.costByCategory, [{ category: 'Soap', amount: 90 }, { category: 'Gas', amount: 10 }]);
});

test('an empty year is empty, not zeros', () => {
  const p = seasonPnl([], '2026');
  assert.equal(p.months.length, 0);
});
