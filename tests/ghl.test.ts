import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callLength, summariseCalls, summarisePipeline, type GhlCall, type GhlOpportunity } from '../src/lib/ghl';

test('pipeline sums open deals by stage in pipeline order and keeps won separate', () => {
  const deal = (o: Partial<GhlOpportunity>): GhlOpportunity => ({ id: 'd', name: 'Deal', value: 100, status: 'open', stage: 'New Lead', contact: '', updated: '', ...o });
  const p = summarisePipeline({ stages: ['New Lead', 'Qualified', 'Closed'], opportunities: [
    deal({}), deal({ stage: 'Qualified', value: 250 }), deal({ stage: 'Qualified', value: null }), deal({ stage: 'Closed', status: 'won', value: 900 }),
    deal({ status: 'abandoned', value: 5000 }), deal({ stage: 'Removed stage', value: 40 }),
  ] });
  assert.equal(p.openCount, 4);
  assert.equal(p.openValue, 390);
  assert.equal(p.wonValue, 900);
  assert.deepEqual(p.stages, [{ stage: 'New Lead', count: 1, value: 100 }, { stage: 'Qualified', count: 2, value: 250 }, { stage: 'Closed', count: 0, value: 0 }, { stage: 'Removed stage', count: 1, value: 40 }]);
});

test('call summary covers the last 30 days and averages only calls with a length', () => {
  const now = new Date(2026, 9, 3, 12, 0);
  const call = (daysAgo: number, c: Partial<GhlCall> = {}): GhlCall => ({ id: String(daysAgo), contact: 'Caller', direction: 'inbound', status: 'completed', seconds: 60, at: new Date(2026, 9, 3 - daysAgo, 10, 0).toISOString(), ...c });
  const s = summariseCalls([call(0), call(29, { seconds: 120, direction: 'outbound' }), call(5, { seconds: null }), call(30)], now);
  assert.equal(s.recent, 3);
  assert.equal(s.inbound, 2);
  assert.equal(s.averageSeconds, 90);
  assert.equal(summariseCalls([], now).averageSeconds, null);
  assert.equal(callLength(125), '2:05');
  assert.equal(callLength(null), '-');
});
