import assert from 'node:assert/strict';
import test from 'node:test';
import { seasonFor, winterPlan } from '../src/lib/season';
import { truckFund } from '../src/lib/truck-fund';
import type { ExteriorData, ExtLead } from '../src/lib/exterior';

const NOW = Date.parse('2026-11-05T18:00:00Z');
const lead = (id: string, over: Partial<ExtLead> = {}): ExtLead => ({ id, name: id, phone: '+14145550100', address: null, service_requested: null, quote_amount: null, status: 'completed', source: null, notes: null, job_revenue: 300, job_cost: null, created_at: '2026-06-01T12:00:00Z', updated_at: null, completed_at: '2026-06-10T15:00:00Z', ...over });
const data = (leads: ExtLead[]): ExteriorData => ({ leads, bookings: [], sessions: [], activity: [], extras: null });

test('April through October is in season; November through March is off-season', () => {
  assert.deepEqual(['2026-03-31', '2026-04-01', '2026-10-31', '2026-11-01', '2027-01-15'].map(seasonFor), ['off-season', 'in-season', 'in-season', 'off-season', 'off-season']);
});

test('the winter plan counts rebook customers, values a quarter of them at the average job, and totals open quotes', () => {
  const p = winterPlan(data([
    lead('a', { phone: '+14145550101', job_revenue: 200 }), lead('b', { phone: '+14145550102', job_revenue: 400 }),
    lead('c', { phone: '+14145550103', job_revenue: null }),
    lead('q1', { status: 'contacted', quote_amount: 900, job_revenue: null }), lead('q2', { status: 'following_up', quote_amount: 100, job_revenue: null }),
  ]), NOW, truckFund([], '2026-11-05'));
  assert.equal(p.rebook.customers, 3);
  assert.equal(p.rebook.avgJob, 300);
  assert.equal(p.rebook.ifQuarterRebook, Math.round(3 * 0.25 * 300));
  assert.deepEqual(p.openQuotes, { count: 2, value: 1000 });
  assert.equal(p.truck.known, false);
});

test('with no recorded revenue there is no average job and no value is quoted', () => {
  const p = winterPlan(data([lead('a', { job_revenue: null })]), NOW, truckFund([], '2026-11-05'));
  assert.equal(p.rebook.avgJob, null);
  assert.equal(p.rebook.ifQuarterRebook, null);
});
