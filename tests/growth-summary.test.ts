import test from 'node:test';
import assert from 'node:assert/strict';
import { funnel, nextActions } from '../src/lib/growth-summary';

const p = (source_status: string, outreach_status: string | null = null) => ({ source_status, outreach_status }) as Parameters<typeof funnel>[0][number];

test('funnel counts by current status and shows no rate without a denominator', () => {
  const f = funnel([p('Not Sent'), p('Not Sent', 'Emailed'), p('Emailed'), p('DMed'), p('Replied'), p('Not Sent', 'Demo Booked'), p('Dead'), p('Not Interested')]);
  assert.deepEqual([f.total, f.contacted, f.replied, f.demos], [8, 6, 2, 1]);
  assert.equal(f.byStatus['Not Sent'], 1);
  assert.equal(f.replyRate, 2 / 6);
  assert.equal(f.demoRate, 1 / 2);
  const empty = funnel([p('Not Sent')]);
  assert.deepEqual([empty.replyRate, empty.demoRate], [null, null]);
});

test('next actions are ordered by what is warmest', () => {
  const base = { goal: 10, done: 4, hour: 11, replies: 0, consultationsRequested: 0, email: { installed: true, running: true, label: 'Running' } };
  assert.deepEqual(nextActions(base).map(a => a.id), ['dms']);
  assert.deepEqual(nextActions({ ...base, replies: 2, consultationsRequested: 1 }).map(a => a.id), ['replies', 'requests', 'dms']);
  assert.equal(nextActions({ ...base, hour: 19 })[0].tone, 'urgent');
  assert.deepEqual(nextActions({ ...base, done: 10 }).map(a => a.id), []);
  assert.deepEqual(nextActions({ ...base, sundayOff: true }).map(a => a.id), []);
  assert.deepEqual(nextActions({ ...base, email: { installed: false, running: false, label: 'Not started' } }).map(a => a.id), ['dms', 'email-install']);
  assert.match(nextActions({ ...base, email: { installed: true, running: false, label: 'Stopped checking in' } }).at(-1)!.text, /stopped checking in/);
  assert.deepEqual(nextActions({ ...base, email: null }).map(a => a.id), ['dms']);
});
