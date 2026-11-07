import test from 'node:test';
import assert from 'node:assert/strict';
import { leadQualitySummary } from '../src/lib/outreach-quality';
import type { SkipRecord } from '../src/lib/outreach-skips';
const row = (id: string, reason: SkipRecord['reason'], at: string): SkipRecord => ({
  id, prospect_id: id, organization_id: 'org', actor_id: 'actor', business_name: 'Business',
  source_row: 3, channel: 'instagram', reason, note: 'bad profile', skipped_at: at,
});
test('quality rate counts verified sends and skips, with recent skips newest first', () => {
  const data = leadQualitySummary([
    row('a', 'Message is bad', '2026-11-01T10:00:00Z'),
    row('b', 'Not a fit', '2026-11-02T10:00:00Z'),
  ], 6);
  assert.equal(data.rate, .25);
  assert.equal(data.byReason['Not a fit'], 1);
  assert.deepEqual(data.recent.map(s => s.id), ['b','a']);
  assert.equal(leadQualitySummary([], 0).rate, null);
});
