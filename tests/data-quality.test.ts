import assert from 'node:assert/strict';
import test from 'node:test';
import { dataQuality } from '../src/lib/data-quality';
import type { ExteriorData, ExtLead, ExtBooking } from '../src/lib/exterior';

const lead = (id: string, over: Partial<ExtLead> = {}): ExtLead => ({ id, name: id, phone: '+14145550100', address: '1 Main St', service_requested: 'House Washing', quote_amount: 200, status: 'new', source: 'lsa', notes: null, job_revenue: null, job_cost: null, created_at: '2026-10-01T10:00:00Z', updated_at: null, completed_at: null, ...over });
const booking = (id: string, lead_id: string, date: string, status = 'confirmed'): ExtBooking => ({ id, lead_id, date, time_block: '9-11', status });
const data = (leads: ExtLead[], bookings: ExtBooking[] = []): ExteriorData => ({ leads, bookings, sessions: [], activity: [], extras: null });

test('finished jobs missing revenue or cost are counted with sample names', () => {
  const q = dataQuality(data([lead('a', { status: 'completed', job_revenue: 100, job_cost: null }), lead('b', { status: 'completed' }), lead('c', { status: 'completed', job_revenue: 50, job_cost: 5 })]), '2026-10-27');
  const rev = q.checks.find(c => c.id === 'no-revenue')!, cost = q.checks.find(c => c.id === 'no-cost')!;
  assert.deepEqual([rev.count, rev.of, rev.sample], [1, 3, ['b']]);
  assert.deepEqual([cost.count, cost.of], [2, 3]);
});

test('upcoming jobs are checked for price and address; past and cancelled ones are not', () => {
  const q = dataQuality(data(
    [lead('x', { quote_amount: null, status: 'booked' }), lead('y', { address: ' ', status: 'booked' }), lead('z', { quote_amount: null, status: 'booked' })],
    [booking('1', 'x', '2026-10-30'), booking('2', 'y', '2026-10-31'), booking('3', 'z', '2026-10-01'), booking('4', 'z', '2026-11-02', 'cancelled')],
  ), '2026-10-27');
  assert.deepEqual(q.checks.find(c => c.id === 'upcoming-no-quote')!.sample, ['x']);
  assert.deepEqual(q.checks.find(c => c.id === 'upcoming-no-address')!.sample, ['y']);
});

test('placeholder phones and blank or other sources are flagged, and a clean set has nothing to fix', () => {
  const q = dataQuality(data([lead('p', { phone: 'NP_123' }), lead('s', { source: null }), lead('t', { source: 'other' })]), '2026-10-27');
  assert.equal(q.checks.find(c => c.id === 'open-no-phone')!.count, 1);
  assert.equal(q.checks.find(c => c.id === 'no-source')!.count, 2);
  const clean = dataQuality(data([lead('ok', { status: 'completed', job_revenue: 10, job_cost: 1 })]), '2026-10-27');
  assert.deepEqual(clean.checks, []);
  assert.equal(clean.tidy, 100);
});

test('the same phone on two open leads is one duplicate group; two completed jobs for a returning client are never duplicates', () => {
  const dup = dataQuality(data([lead('d1', { phone: '+14145550199' }), lead('d2', { phone: '+14145550199' })]), '2026-10-27');
  assert.equal(dup.checks.find(c => c.id === 'duplicates')!.count, 1);
  const repeat = dataQuality(data([lead('r1', { phone: '+14145550777', status: 'completed', job_revenue: 1, job_cost: 1 }), lead('r2', { phone: '+14145550777', status: 'completed', job_revenue: 2, job_cost: 1 })]), '2026-10-27');
  assert.equal(repeat.checks.find(c => c.id === 'duplicates'), undefined);
});

test('no records means no score', () => {
  assert.equal(dataQuality(data([]), '2026-10-27').tidy, null);
});
