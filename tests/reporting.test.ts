import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobFigures, sourceLabel, summariseJobs, type ExtLead } from '../src/lib/exterior';
import { businessDay, emptyJobFilters, exteriorFinance, filterCompletedJobs, operationalAnalytics, shopifyFinance } from '../src/lib/reporting';
import { sampleExterior } from '../src/lib/exterior-sample';
import type { ShopOrder } from '../src/lib/shopify';
import { emptyDashboard, type Dashboard } from '../src/lib/dashboard';
import type { Card } from '../src/lib/board';

const lead = (patch: Partial<ExtLead>): ExtLead => ({ id: 'sample', name: 'Sample', phone: null, address: null, service_requested: 'House Washing', quote_amount: 500, status: 'completed', source: 'dtd', notes: null, job_revenue: null, job_cost: null, created_at: '2026-09-01T12:00:00Z', updated_at: null, completed_at: '2026-10-01T12:00:00Z', ...patch });
const order = (patch: Partial<ShopOrder>): ShopOrder => ({ id: 'o', name: '#Sample', createdAt: '2026-10-01T12:00:00Z', total: 250, paid: 'PAID', fulfilled: 'FULFILLED', cancelled: false, test: false, items: [], ...patch });

test('a missing cost or payment never becomes known zero or total profit', () => {
  const summary = jobFigures([lead({ job_revenue: 500 }), lead({ job_cost: 30 })]);
  assert.equal(summary.revenue, 500);
  assert.equal(summary.cost, 30);
  assert.equal(summary.contribution, null);
  assert.equal(summary.matchedJobs, 0);
  assert.equal(summary.missingCosts, 1);
  assert.equal(summary.missingRevenue, 1);
  assert.equal(jobFigures([lead({})]).revenue, null);
  assert.equal(jobFigures([]).contribution, null);
  const zero = jobFigures([lead({ job_revenue: 0, job_cost: 0 })]);
  assert.equal(zero.contribution, 0);
  assert.equal(zero.matchedJobs, 1);
  assert.equal(zero.missingRevenue, 0);
});

test('job reports and underlying source rows reconcile across date, service and source filters', () => {
  const leads = [
    lead({ id: 'a', job_revenue: 500, job_cost: 50 }),
    lead({ id: 'b', job_revenue: 100, job_cost: 0, source: 'DTD' }),
    lead({ id: 'c', job_revenue: 250, source: 'Facebook' }),
    lead({ id: 'd', job_revenue: 300, service_requested: 'Roof Cleaning' }),
    lead({ id: 'e', job_revenue: 999, completed_at: '2026-11-01T12:00:00Z' }),
    lead({ id: 'f', status: 'booked', job_revenue: 888 }),
  ];
  const rows = filterCompletedJobs(leads, { from: '2026-10-01', to: '2026-10-31', service: 'House Washing', source: 'Door to door' }, sourceLabel);
  assert.deepEqual(rows.map(row => row.id), ['a', 'b']);
  const summary = summariseJobs(rows, iso => businessDay(iso)!.slice(0, 7));
  assert.equal(summary.revenue, 600);
  assert.equal(summary.contribution, 550);
  assert.equal(summary.byMonth[0].revenue, summary.revenue);
  assert.equal(summary.byService[0].revenue, summary.revenue);
  assert.equal(summary.bySource[0].revenue, summary.revenue);
  assert.equal(filterCompletedJobs(leads, { ...emptyJobFilters, from: '2026-11-01', to: '2026-10-01' }, sourceLabel).length, 0);
});

test('business calendar is Chicago even at UTC month boundaries and daylight-saving changes', () => {
  assert.equal(businessDay('2026-10-01T01:00:00Z'), '2026-09-30');
  assert.equal(businessDay('2026-01-01T05:00:00Z'), '2025-12-31');
  assert.equal(businessDay('2026-10-01'), '2026-10-01');
  assert.equal(businessDay('bad date'), null);
});

test('external job rows retain actual zero and expose completion-date provenance', () => {
  const result = exteriorFinance([
    lead({ id: 'explicit-zero', job_revenue: 0, job_cost: 0 }),
    lead({ id: 'update-estimate', job_revenue: 200, completed_at: null, updated_at: '2026-10-02T12:00:00Z' }),
    lead({ id: 'create-estimate', job_revenue: 300, completed_at: null }),
    lead({ id: 'quote-only', quote_amount: 999 }),
    lead({ id: 'not-done', status: 'booked', job_revenue: 999 }),
  ]);
  assert.equal(result.finance.length, 4);
  assert.equal(result.finance.find(row => row.id === 'job-explicit-zero')?.amount, 0);
  assert.equal(result.finance.find(row => row.id === 'job-update-estimate')?.dateBasis, 'updated-estimate');
  assert.equal(result.finance.find(row => row.id === 'job-create-estimate')?.dateBasis, 'created-estimate');
  assert.equal(result.coverage.estimatedDateJobs, 2);
  assert.equal(result.coverage.missingCosts, 3);
});

test('shared revenue excludes unpaid, partial, refunded, test, cancelled and foreign-currency orders', () => {
  const orders = [order({ id: 'paid' }), ...['PENDING', 'AUTHORIZED', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', ''].map(paid => order({ id: paid, paid })), order({ id: 'cancelled', cancelled: true }), order({ id: 'test', test: true })];
  assert.deepEqual(shopifyFinance(orders, 'USD').map(row => row.id), ['shopify-paid']);
  assert.equal(shopifyFinance(orders, 'CAD').length, 0);
  assert.equal(shopifyFinance(orders, 'USD')[0].dateBasis, 'order-created');
});

test('sample records exercise missing figures and estimated dates without masquerading as live customers', () => {
  const sample = sampleExterior(new Date('2026-10-04T12:00:00Z'));
  assert.ok(sample.leads.every(row => row.id.startsWith('sample-') && row.name?.startsWith('Sample:')));
  const summary = summariseJobs(sample.leads, iso => businessDay(iso)!.slice(0, 7));
  assert.equal(summary.jobs, 5);
  assert.equal(summary.matchedJobs, 2);
  assert.equal(summary.contribution, 515);
  assert.equal(summary.missingCosts, 2);
});

test('analytics business and date filters reconcile source entries, month totals and business totals', () => {
  const data: Dashboard = { ...emptyDashboard, finance: [
    { id: 'oct-income', venture: 'exterior', kind: 'revenue', amount: 500, occurred_on: '2026-10-02', category: '', note: '' },
    { id: 'oct-cost', venture: 'exterior', kind: 'cost', amount: 50, occurred_on: '2026-10-02', category: '', note: '' },
    { id: 'sep-income', venture: 'exterior', kind: 'revenue', amount: 300, occurred_on: '2026-09-30', category: '', note: '' },
    { id: 'other-business', venture: 'solutions', kind: 'revenue', amount: 900, occurred_on: '2026-10-02', category: '', note: '' },
  ] };
  const report = operationalAnalytics(data, [], { venture: 'exterior', from: '2026-10-01', to: '2026-10-03' }, '2026-10-03');
  assert.deepEqual(report.finance.map(row => row.id), ['oct-income', 'oct-cost']);
  assert.equal(report.revenue, 500);
  assert.equal(report.cost, 50);
  assert.equal(report.net, 450);
  assert.equal(report.businesses.length, 1);
  assert.equal(report.businesses[0].revenue, report.revenue);
  assert.equal(report.months[0].revenue, report.revenue);
  assert.equal(report.months[0].byBusiness[0].revenue, report.revenue);
  const other = operationalAnalytics(data, [], { venture: 'solutions', from: '', to: '' }, '2026-10-03');
  assert.equal(other.cost, null);
  assert.equal(other.net, null, 'no recorded costs is not a $900 profit');
  assert.equal(operationalAnalytics(emptyDashboard, [], { venture: 'all', from: '', to: '' }, '2026-10-03').revenue, null);
});

test('analytics lead win rate is the current status of the creation cohort, excluding undecided leads', () => {
  const data: Dashboard = { ...emptyDashboard, leads: [
    { id: 'won', venture: 'exterior', name: 'A', contact: '', stage: 'Won', value: 500, source: '', notes: '', created_at: '2026-10-02T12:00:00Z' },
    { id: 'lost', venture: 'exterior', name: 'B', contact: '', stage: 'Lost', value: 600, source: '', notes: '', created_at: '2026-10-02T12:00:00Z' },
    { id: 'open', venture: 'exterior', name: 'C', contact: '', stage: 'New', value: 700, source: '', notes: '', created_at: '2026-10-02T12:00:00Z' },
    { id: 'old', venture: 'exterior', name: 'D', contact: '', stage: 'Won', value: 999, source: '', notes: '', created_at: '2026-10-01T01:00:00Z' },
  ] };
  const report = operationalAnalytics(data, [], { venture: 'all', from: '2026-10-01', to: '2026-10-03' }, '2026-10-03');
  assert.equal(report.leads.length, 3, 'UTC October 1 before Chicago midnight belongs to September');
  assert.equal(report.businesses.find(row => row.venture === 'exterior')?.winRate, 0.5);
  assert.equal(report.revenue, null, 'quote/deal values do not create revenue');
});

test('current task workload applies business scope without fabricating historical completion rates', () => {
  const card = (patch: Partial<Card>): Card => ({ id: 'task', organization_id: 'sample', title: 'Task', description: '', business: 'exterior', stage: 'Ready', priority: 'normal', assignee: 'Oscar', due_date: '2026-09-30', revision: 0, checklist: [], ...patch });
  const report = operationalAnalytics(emptyDashboard, [card({}), card({ id: 'unassigned', assignee: '', due_date: '' }), card({ id: 'finished', stage: 'Done' }), card({ id: 'other', business: 'solutions' })], { venture: 'exterior', from: '2026-10-01', to: '2026-10-03' }, '2026-10-03');
  assert.equal(report.tasks.length, 3);
  assert.equal(report.businesses[0].open, 2);
  assert.equal(report.businesses[0].done, 1);
  assert.equal(report.businesses[0].overdue, 1);
  assert.deepEqual(report.owners.map(owner => [owner.owner, owner.open, owner.overdue]), [['Oscar', 1, 1], ['Unassigned', 1, 0]]);
});
