import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceLabel } from '../src/lib/exterior';
import { leadSources } from '../src/lib/exterior-ops';

test('Local Services Ads and Business Profile are selectable sources with readable labels', () => {
  const values = leadSources.map(([value]) => value);
  assert.ok(values.includes('lsa') && values.includes('gbp'));
  assert.equal(sourceLabel('lsa'), 'Local Services Ads');
  assert.equal(sourceLabel('LSA'), 'Local Services Ads');
  assert.equal(sourceLabel('gbp'), 'Google Business Profile');
  assert.equal(sourceLabel('dtd'), 'Door to door');
  assert.equal(sourceLabel(null), 'Unknown');
});

test('lead source values are unique', () => {
  const values = leadSources.map(([value]) => value);
  assert.equal(new Set(values).size, values.length);
});
