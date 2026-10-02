import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceLabel, summariseLeads, summariseSessions, threads, type ExtLead, type ExtMessage, type ExtSession } from '../src/lib/exterior';

const lead = (l: Partial<ExtLead>): ExtLead => ({ id: 'a', name: 'A', phone: null, address: null, service_requested: null, quote_amount: null, status: 'new', source: null, job_revenue: null, job_cost: null, created_at: '2026-05-01T00:00:00Z', updated_at: null, completed_at: null, ...l });

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

test('door-knocking rates come from totals and are unknown with no doors', () => {
  const session = (x: Partial<ExtSession>): ExtSession => ({ id: 's', session_date: '2026-05-01', knocked_by: null, area: null, doors_knocked: null, answers: null, interested: null, quotes_given: null, jobs_scheduled: null, job_total: null, ...x });
  const s = summariseSessions([session({ doors_knocked: 100, answers: 30, jobs_scheduled: 2, job_total: 500 }), session({ doors_knocked: 100, answers: 10 })]);
  assert.equal(s.answerRate, 0.2);
  assert.equal(s.perDoor, 2.5);
  assert.equal(summariseSessions([session({})]).answerRate, null);
});

test('texts group by lead, oldest first inside a thread, most recent thread first', () => {
  const m = (id: string, lead_id: string, created_at: string): ExtMessage => ({ id, lead_id, direction: 'inbound', body: id, created_at });
  const t = threads([m('2', 'a', '2026-05-02'), m('1', 'a', '2026-05-01'), m('3', 'b', '2026-05-03')], [lead({ id: 'a', name: 'Ann' })]);
  assert.deepEqual(t.map(x => x.name), ['Unknown lead', 'Ann']);
  assert.deepEqual(t[1].messages.map(x => x.id), ['1', '2']);
});

test('source spellings from the old app collapse to one label', () => {
  assert.deepEqual(['dtd', 'DTD', 'door-to-door', 'Facebook', '', null].map(sourceLabel), ['Door to door', 'Door to door', 'Door to door', 'Facebook', 'Unknown', 'Unknown']);
});
