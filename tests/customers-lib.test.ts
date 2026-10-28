import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectory, filterDirectory, segmentCounts, type Customer, type LeadLink, type Property } from '../src/lib/customers';
import type { ExtLead } from '../src/lib/exterior';

const cust = (id: string, name: string, phone: string | null = '(414) 555-0100'): Customer => ({ id, kind: 'person', name, phone, email: null, notes: '', created_at: '2026-06-01T00:00:00Z' });
const lead = (id: string, over: Partial<ExtLead> = {}): ExtLead => ({ id, name: id, phone: null, address: null, service_requested: null, quote_amount: null, status: 'completed', source: null, notes: null, job_revenue: 200, job_cost: null, created_at: '2026-06-01T12:00:00Z', updated_at: null, completed_at: '2026-06-10T15:00:00Z', ...over });
const prop = (id: string, customer_id: string, address: string): Property => ({ id, customer_id, label: '', address, access_notes: '', water_notes: '', surface_notes: '' });
const link = (lead_id: string, customer_id: string): LeadLink => ({ lead_id, customer_id, property_id: null });
const TODAY = '2026-10-27';

test('a row carries the jobs linked to the customer, their lifetime revenue and when they are next due', () => {
  const rows = buildDirectory([cust('c1', 'Fay')], [prop('p1', 'c1', '1 Main St')], [link('a', 'c1'), link('b', 'c1')],
    [lead('a', { job_revenue: 200, completed_at: '2025-08-01T15:00:00Z' }), lead('b', { job_revenue: 150, completed_at: '2026-06-10T15:00:00Z' })]);
  assert.equal(rows[0].lifetimeRevenue, 350);
  assert.equal(rows[0].completed, 2);
  assert.equal(rows[0].lastService, '2026-06-10');
  assert.equal(rows[0].nextDue, '2027-06-10');
  assert.equal(rows[0].properties.length, 1);
});

test('revenue is unknown, not zero, until a finished job has a figure; open jobs are flagged', () => {
  const rows = buildDirectory([cust('c1', 'Bill'), cust('c2', 'Tom')], [], [link('a', 'c1'), link('b', 'c2')],
    [lead('a', { job_revenue: null }), lead('b', { status: 'booked', job_revenue: null, completed_at: null })]);
  assert.equal(rows[0].lifetimeRevenue, null);
  assert.equal(rows[1].hasOpenJob, true);
  assert.equal(rows[1].lastService, null);
});

test('segments: repeat needs two finished jobs, due is 11+ months since the last one and nothing open, top ranks by revenue, no-phone uses real numbers', () => {
  const customers = [cust('c1', 'Repeat'), cust('c2', 'Old', null), cust('c3', 'Fresh'), cust('c4', 'Busy')];
  const rows = buildDirectory(customers, [], [link('a', 'c1'), link('b', 'c1'), link('c', 'c2'), link('d', 'c3'), link('e', 'c4'), link('f', 'c4')],
    [lead('a', { job_revenue: 500 }), lead('b', { job_revenue: 100 }), lead('c', { job_revenue: 80, completed_at: '2025-09-01T12:00:00Z' }), lead('d', { job_revenue: 60, completed_at: '2026-10-01T12:00:00Z' }),
      lead('e', { job_revenue: 90, completed_at: '2025-08-01T12:00:00Z' }), lead('f', { status: 'booked', job_revenue: null, completed_at: null })]);
  const names = (s: Parameters<typeof filterDirectory>[1]) => filterDirectory(rows, s, '', TODAY).map(r => r.customer.name);
  assert.deepEqual(names('repeat'), ['Repeat']);
  assert.deepEqual(names('due'), ['Old']);
  assert.deepEqual(names('top'), ['Repeat', 'Busy', 'Old', 'Fresh']);
  assert.deepEqual(names('no-phone'), ['Old']);
  assert.deepEqual(names('open'), ['Busy']);
  assert.equal(segmentCounts(rows, TODAY).all, 4);
});

test('search matches the name, the phone and any property address', () => {
  const rows = buildDirectory([cust('c1', 'Fay Akindes'), cust('c2', 'Tom')], [prop('p', 'c2', '3 Elm Rd')], [], []);
  assert.deepEqual(filterDirectory(rows, 'all', 'akin', TODAY).map(r => r.customer.name), ['Fay Akindes']);
  assert.deepEqual(filterDirectory(rows, 'all', 'elm', TODAY).map(r => r.customer.name), ['Tom']);
  assert.equal(filterDirectory(rows, 'all', '555-0100', TODAY).length, 2);
  assert.equal(filterDirectory(rows, 'all', 'nobody', TODAY).length, 0);
});
