import assert from 'node:assert/strict';
import test from 'node:test';
import { todayJobs } from '../src/lib/today-jobs';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const job = (id: string, date: string, time_block: string, over: Partial<JobItem> = {}): JobItem => ({ id, lead_id: id, date, time_block, status: 'confirmed', name: id, service: null, address: null, quote: null, ...over });

test('jobs are grouped into today, tomorrow and the rest of the week, earliest first', () => {
  const r = todayJobs([
    job('b', '2026-10-27', '2:30-4'), job('a', '2026-10-27', '9-11'), job('c', '2026-10-28', '10-12'),
    job('d', '2026-10-30', '1-3'), job('e', '2026-11-03', '1-3'), job('f', '2026-11-04', '1-3'), job('old', '2026-10-20', '9-11'),
  ], '2026-10-27');
  assert.deepEqual(r.today.map(j => j.id), ['a', 'b']);
  assert.deepEqual(r.tomorrow.map(j => j.id), ['c']);
  assert.deepEqual(r.later.map(j => j.id), ['d', 'e']);
});

test('afternoon blocks sort after morning blocks even though 1 is smaller than 9', () => {
  assert.deepEqual(todayJobs([job('pm', '2026-10-27', '1-3'), job('am', '2026-10-27', '9-11')], '2026-10-27').today.map(j => j.id), ['am', 'pm']);
});

test('cancelled and denied jobs never show, and an unreadable time sorts last', () => {
  const r = todayJobs([job('x', '2026-10-27', '9-11', { status: 'cancelled' }), job('y', '2026-10-27', '9-11', { status: 'denied' }), job('weird', '2026-10-27', 'sometime'), job('ok', '2026-10-27', '3-5')], '2026-10-27');
  assert.deepEqual(r.today.map(j => j.id), ['ok', 'weird']);
});
