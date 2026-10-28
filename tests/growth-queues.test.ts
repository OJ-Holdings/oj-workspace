import assert from 'node:assert/strict';
import test from 'node:test';
import { coldQuotes, pipeline, waitingLeads } from '../src/lib/growth-queues';
import type { ExtLead } from '../src/lib/exterior';

const NOW = Date.parse('2026-10-27T18:00:00Z');
const lead = (id: string, over: Partial<ExtLead> = {}): ExtLead => ({ id, name: id, phone: null, address: null, service_requested: null, quote_amount: null, status: 'new', source: null, notes: null, job_revenue: null, job_cost: null, created_at: '2026-10-27T17:00:00Z', updated_at: null, completed_at: null, ...over });

test('only new leads wait; oldest first; late after 30 minutes', () => {
  const w = waitingLeads([lead('a', { created_at: '2026-10-27T17:50:00Z' }), lead('b', { created_at: '2026-10-27T16:00:00Z' }), lead('c', { status: 'contacted' })], NOW);
  assert.deepEqual(w.map(x => [x.lead.id, x.minutes, x.late]), [['b', 120, true], ['a', 10, false]]);
});

test('cold quotes: open, quoted, untouched for 3+ days, biggest first', () => {
  const q = coldQuotes([
    lead('old-big', { status: 'following_up', quote_amount: 900, updated_at: '2026-10-20T12:00:00Z' }),
    lead('old-small', { status: 'contacted', quote_amount: 200, updated_at: '2026-10-23T12:00:00Z' }),
    lead('fresh', { status: 'contacted', quote_amount: 5000, updated_at: '2026-10-27T12:00:00Z' }),
    lead('no-quote', { status: 'contacted', updated_at: '2026-10-01T12:00:00Z' }),
    lead('booked', { status: 'booked', quote_amount: 800, updated_at: '2026-10-01T12:00:00Z' }),
  ], NOW);
  assert.deepEqual(q.map(x => [x.lead.id, x.days]), [['old-big', 7], ['old-small', 4]]);
});

test('pipeline counts and quoted value per stage', () => {
  const p = pipeline([lead('a', { quote_amount: 100 }), lead('b', { status: 'booked', quote_amount: 300 }), lead('c', { status: 'booked' })]);
  assert.deepEqual([p.new, p.booked], [{ count: 1, quoted: 100 }, { count: 2, quoted: 300 }]);
});
