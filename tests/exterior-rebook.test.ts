import assert from 'node:assert/strict';
import test from 'node:test';
import { rebookCandidates } from '../src/lib/exterior-rebook';
import type { ExtLead } from '../src/lib/exterior';

const lead = (id: string, over: Partial<ExtLead>): ExtLead => ({ id, name: id, phone: '+12625550100', address: null, service_requested: 'House Washing', quote_amount: null, status: 'completed', source: null, notes: null, job_revenue: 300, job_cost: null, created_at: '2026-04-01T12:00:00Z', updated_at: '2026-04-01T12:00:00Z', completed_at: '2026-04-10T12:00:00Z', ...over } as ExtLead);
const now = new Date('2026-10-27T12:00:00Z');

test('keeps one row per customer using the newest completed job', () => {
  const rows = rebookCandidates([lead('a', { completed_at: '2026-04-10T12:00:00Z' }), lead('b', { completed_at: '2026-05-02T12:00:00Z' })], now, 3);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'b');
});

test('only completed customers whose latest job is old enough are listed, oldest first', () => {
  const rows = rebookCandidates([
    lead('old', { phone: '+12625550101', completed_at: '2026-04-01T12:00:00Z' }),
    lead('older', { phone: '+12625550102', completed_at: '2026-03-01T12:00:00Z' }),
    lead('recent', { phone: '+12625550103', completed_at: '2026-10-10T12:00:00Z' }),
    lead('open', { phone: '+12625550104', status: 'booked', completed_at: null }),
  ], now, 5);
  assert.deepEqual(rows.map(r => r.id), ['older', 'old']);
});

test('customers without a real phone are matched by exact name, not merged with each other', () => {
  const rows = rebookCandidates([
    lead('x1', { phone: 'NP_1', name: 'Pat', completed_at: '2026-04-01T12:00:00Z' }),
    lead('x2', { phone: 'NP_2', name: 'Sam', completed_at: '2026-04-02T12:00:00Z' }),
    lead('x3', { phone: 'NO_PHONE_3', name: 'pat', completed_at: '2026-04-20T12:00:00Z' }),
  ], now, 3);
  assert.equal(rows.length, 2);
  assert.ok(rows.some(r => r.id === 'x3') && rows.some(r => r.id === 'x2'));
});
