import assert from 'node:assert/strict';
import test from 'node:test';
import { LSA_LEADS, LSA_SPEND, lsaMonth } from '../src/lib/lsa-stats';
import type { MetricEntry } from '../src/lib/dashboard';
import type { ExtLead } from '../src/lib/exterior';

const m = (label: string, value: number, measured_on: string, over: Partial<MetricEntry> = {}): MetricEntry => ({ id: label + measured_on + value, venture: 'exterior', label, value, unit: '', measured_on, note: '', ...over });
const lead = (id: string, over: Partial<ExtLead>): ExtLead => ({ id, name: id, phone: '+12625550100', address: null, service_requested: null, quote_amount: null, status: 'completed', source: 'lsa', notes: null, job_revenue: 400, job_cost: null, created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-05T12:00:00Z', completed_at: '2026-10-10T12:00:00Z', ...over } as ExtLead);

test('spend and leads are summed for the month only', () => {
  const r = lsaMonth([m(LSA_SPEND, 300, '2026-10-05'), m(LSA_SPEND, 500, '2026-10-19'), m(LSA_LEADS, 8, '2026-10-05'), m(LSA_LEADS, 12, '2026-10-19'), m(LSA_SPEND, 999, '2026-09-28')], [], '2026-10');
  assert.equal(r.spend, 800); assert.equal(r.leads, 20); assert.equal(r.costPerLead, 40); assert.equal(r.entries, 4);
});

test('cost per job and return only count completed jobs tagged LSA in that month', () => {
  const r = lsaMonth([m(LSA_SPEND, 800, '2026-10-05')], [lead('a', {}), lead('b', { job_revenue: 1000 }), lead('c', { source: 'dtd' }), lead('d', { completed_at: '2026-09-10T12:00:00Z', updated_at: '2026-09-10T12:00:00Z' }), lead('e', { status: 'booked' })], '2026-10');
  assert.equal(r.jobs, 2); assert.equal(r.revenue, 1400); assert.equal(r.costPerJob, 400); assert.equal(r.returnOnSpend, 1.75);
});

test('nothing is invented when inputs are missing', () => {
  const none = lsaMonth([], [], '2026-10');
  assert.deepEqual([none.costPerLead, none.costPerJob, none.returnOnSpend], [null, null, null]);
  const noRevenue = lsaMonth([m(LSA_SPEND, 100, '2026-10-05')], [lead('x', { job_revenue: null })], '2026-10');
  assert.equal(noRevenue.jobs, 1); assert.equal(noRevenue.revenueJobs, 0); assert.equal(noRevenue.returnOnSpend, null); assert.equal(noRevenue.costPerJob, 100);
  assert.equal(lsaMonth([m(LSA_LEADS, 5, '2026-10-05')], [], '2026-10').costPerLead, null);
});

test('other businesses and other labels are ignored', () => {
  const r = lsaMonth([m(LSA_SPEND, 100, '2026-10-05', { venture: 'solutions' }), m('Other spend', 100, '2026-10-05')], [], '2026-10');
  assert.equal(r.spend, 0);
});
