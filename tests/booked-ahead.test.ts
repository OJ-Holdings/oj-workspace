import assert from 'node:assert/strict';
import test from 'node:test';
import { bookedAhead } from '../src/lib/booked-ahead';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const job = (date: string, quote: number | null, status: string | null = 'confirmed'): JobItem => ({ id: date + quote, lead_id: 'l', date, time_block: '', status, name: 'A', service: null, address: null, quote });

test('buckets upcoming jobs by week and sums quotes', () => {
  const a = bookedAhead([job('2026-10-27', 300), job('2026-11-02', 200), job('2026-11-03', 100), job('2026-11-20', 500)], '2026-10-27');
  assert.deepEqual(a.weeks.map(w => [w.jobs, w.quoted]), [[2, 500], [1, 100], [0, 0], [1, 500]]);
  assert.equal(a.jobs, 4);
  assert.equal(a.quoted, 1100);
});

test('past, cancelled, denied and beyond four weeks are left out; no quote is counted but not valued', () => {
  const a = bookedAhead([job('2026-10-26', 999), job('2026-10-28', 50, 'cancelled'), job('2026-10-28', 50, 'denied'), job('2026-11-24', 70), job('2026-10-29', null)], '2026-10-27');
  assert.equal(a.jobs, 1);
  assert.equal(a.quoted, 0);
  assert.equal(a.unquoted, 1);
});
