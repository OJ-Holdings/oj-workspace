import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceLabel, summariseJobs, summariseLeads, summariseSessions, type ExtLead, type ExtSession } from '../src/lib/exterior';

const lead = (l: Partial<ExtLead>): ExtLead => ({ id: 'a', name: 'A', phone: null, address: null, service_requested: null, quote_amount: null, status: 'new', source: null, notes: null, job_revenue: null, job_cost: null, created_at: '2026-05-01T00:00:00Z', updated_at: null, completed_at: null, ...l });

test('lead summary never treats a quote or a missing figure as revenue', () => {
  const s = summariseLeads([
    lead({ status: 'completed', job_revenue: 300, quote_amount: 350 }),
    lead({ status: 'completed', job_revenue: null, quote_amount: 500 }),
    lead({ status: 'following_up', quote_amount: 200 }),
    lead({ status: 'closed', job_revenue: 999 }),
  ]);
  assert.equal(s.revenue, 300);
  assert.equal(s.revenueJobs, 1);
  assert.equal(s.completed, 2);
  assert.equal(s.open, 1);
  assert.equal(summariseLeads([lead({ status: 'completed' })]).revenue, null);
});

test('job income counts completed jobs only, by month, service and source', () => {
  const j = summariseJobs([
    lead({ status: 'completed', job_revenue: 300, job_cost: 20, service_requested: 'House Wash', source: 'dtd', completed_at: '2026-06-10T12:00:00Z' }),
    lead({ status: 'completed', job_revenue: 500, service_requested: 'House Wash', source: 'DTD', completed_at: null, updated_at: '2026-07-02T12:00:00Z' }),
    lead({ status: 'completed', job_revenue: null, service_requested: null, source: 'Facebook', completed_at: '2026-07-05T12:00:00Z' }),
    lead({ status: 'following_up', job_revenue: 325, quote_amount: 900, source: 'Facebook' }),
    lead({ status: 'booked', source: 'Facebook' }),
  ], iso => iso.slice(0, 7));
  assert.equal(j.revenue, 800);
  assert.equal(j.cost, 20);
  assert.equal(j.profit, 780);
  assert.equal(j.costJobs, 1);
  assert.equal(j.average, 400);
  assert.deepEqual(j.byMonth.map(m => [m.label, m.jobs, m.revenue]), [['2026-07', 2, 500], ['2026-06', 1, 300]]);
  assert.deepEqual(j.byService.map(s => [s.label, s.revenue]), [['House Wash', 800], ['Unspecified', 0]]);
  assert.deepEqual(j.bySource.map(s => [s.source, s.leads, s.won, s.revenue]), [['Facebook', 3, 2, 0], ['Door to door', 2, 2, 800]]);
});

test('door-knocking rates come from totals and are unknown with no doors', () => {
  const session = (x: Partial<ExtSession>): ExtSession => ({ id: 's', session_date: '2026-05-01', knocked_by: null, area: null, doors_knocked: null, answers: null, interested: null, quotes_given: null, jobs_scheduled: null, job_total: null, ...x });
  const s = summariseSessions([session({ doors_knocked: 100, answers: 30, jobs_scheduled: 2, job_total: 500 }), session({ doors_knocked: 100, answers: 10 })]);
  assert.equal(s.answerRate, 0.2);
  assert.equal(s.perDoor, 2.5);
  assert.equal(summariseSessions([session({})]).answerRate, null);
});

test('source spellings from the old app collapse to one label', () => {
  assert.deepEqual(['dtd', 'DTD', 'door-to-door', 'Facebook', '', null].map(sourceLabel), ['Door to door', 'Door to door', 'Door to door', 'Facebook', 'Unknown', 'Unknown']);
});
