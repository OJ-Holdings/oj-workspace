import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveMetrics, emptyDashboard, lastMonths, toICS, type Dashboard } from '../src/lib/dashboard';
import type { Card } from '../src/lib/board';

const now = new Date(2026, 9, 2, 10, 0, 0); // 2 Oct 2026, local time
const card = (over: Partial<Card>): Card => ({ id: 'c1', organization_id: 'o', title: 'Task', description: '', business: 'exterior', stage: 'Ready', priority: 'normal', assignee: '', due_date: '', revision: 0, checklist: [], ...over });

test('a workspace with no records reports nothing, never zeros dressed up as data', () => {
  const m = deriveMetrics(emptyDashboard, [], now);
  assert.deepEqual(m.ventures, { exterior: null, solutions: null, essentials: null });
  assert.equal(m.pipeline, null); assert.equal(m.schedule, null); assert.equal(m.files, null); assert.equal(m.notes, null);
  assert.equal(m.months.length, 12); assert.equal(m.months[11], 'Oct');
});

test('revenue is summed per business per month and change compares with last month', () => {
  const d: Dashboard = { ...emptyDashboard, finance: [
    { id: '1', venture: 'exterior', kind: 'revenue', amount: 300, occurred_on: '2026-10-01', category: '', note: '' },
    { id: '2', venture: 'exterior', kind: 'revenue', amount: 200, occurred_on: '2026-10-02', category: '', note: '' },
    { id: '3', venture: 'exterior', kind: 'revenue', amount: 400, occurred_on: '2026-09-15', category: '', note: '' },
    { id: '4', venture: 'exterior', kind: 'cost', amount: 999, occurred_on: '2026-10-01', category: '', note: '' },
    { id: '5', venture: 'essentials', kind: 'revenue', amount: 50, occurred_on: '2026-10-01', category: '', note: '' },
  ] };
  const m = deriveMetrics(d, [], now);
  assert.equal(m.ventures.exterior?.revenueMtd, 500);
  assert.equal(m.ventures.exterior?.change, 25);
  assert.equal(m.ventures.exterior?.series[10], 400);
  assert.equal(m.ventures.essentials?.change, null, 'no previous month means no percentage, not 0%');
  assert.equal(m.ventures.solutions, null);
});

test('pipeline, active leads and today\'s schedule come from real rows', () => {
  const d: Dashboard = { ...emptyDashboard,
    leads: [
      { id: 'l1', venture: 'solutions', name: 'A', contact: '', stage: 'New', value: null, source: '', notes: '', created_at: '' },
      { id: 'l2', venture: 'solutions', name: 'B', contact: '', stage: 'Won', value: 500, source: '', notes: '', created_at: '' },
      { id: 'l3', venture: 'solutions', name: 'C', contact: '', stage: 'Lost', value: null, source: '', notes: '', created_at: '' },
    ],
    events: [{ id: 'e1', venture: null, title: 'Sync', starts_at: new Date(2026, 9, 2, 16, 0).toISOString(), ends_at: null, all_day: false, location: '', notes: '' },
      { id: 'e2', venture: null, title: 'Tomorrow', starts_at: new Date(2026, 9, 3, 9, 0).toISOString(), ends_at: null, all_day: false, location: '', notes: '' }],
  };
  const m = deriveMetrics(d, [card({ due_date: '2026-10-02' }), card({ id: 'c2', due_date: '2026-10-02', stage: 'Done' })], now);
  assert.equal(m.ventures.solutions?.activeLeads, 1);
  assert.deepEqual(m.pipeline?.map(p => p.count), [1, 0, 0, 0, 1]);
  assert.deepEqual(m.schedule?.map(s => s.title), ['Sync', 'Task']);
});

test('months roll back across a year boundary', () => {
  assert.deepEqual(lastMonths(new Date(2026, 1, 10), 3).map(m => m.key), ['2025-12', '2026-01', '2026-02']);
});

test('calendar file escapes text and marks all-day events', () => {
  const ics = toICS([
    { id: 'a', title: 'Roof wash; 12 Oak, Kenosha', starts_at: '2026-10-05T14:00:00.000Z', ends_at: null, all_day: false, location: '', notes: 'line one\nline two', venture: 'exterior' },
    { id: 'b', title: 'Task due', starts_at: '2026-10-06T00:00:00.000Z', ends_at: null, all_day: true, location: '', notes: '', venture: null },
  ], new Date('2026-10-02T15:00:00.000Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('SUMMARY:Roof wash\\; 12 Oak\\, Kenosha'));
  assert.ok(ics.includes('DESCRIPTION:line one\\nline two'));
  assert.ok(ics.includes('DTSTART:20261005T140000Z') && ics.includes('DTEND:20261005T150000Z'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261006') && ics.includes('DTEND;VALUE=DATE:20261007'));
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
});

test('open leads held in a connected system count as active leads for that business', () => {
  const m = deriveMetrics({ ...emptyDashboard, openElsewhere: { exterior: 32, solutions: 0 } }, [], now);
  assert.equal(m.ventures.exterior?.activeLeads, 32);
  assert.equal(m.ventures.exterior?.revenueMtd, 0);
  assert.equal(m.ventures.solutions, null, 'zero open leads elsewhere and nothing logged still reports nothing');
});
