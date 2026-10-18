import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartPath, chartScale, chartValues, chartX } from '../src/lib/chart-data';

test('missing, non-finite and unequal series retain gaps instead of inventing zero', () => {
  assert.deepEqual(chartValues([0, NaN, 12, Infinity], 5), [0, null, 12, null, null]);
  assert.deepEqual(chartValues([1, 2, 3], 1), [1]);
  assert.equal(chartPath([1, null, 3, 4], i => i * 10, v => v), 'M0.0 1.0 M20.0 3.0 L30.0 4.0');
  assert.equal(chartPath([], i => i, v => v), '');
});

test('single observations are centered and scales remain finite for empty or zero data', () => {
  assert.equal(chartX(0, 1, 10, 90), 50);
  assert.equal(chartX(1, 3, 10, 90), 50);
  for (const values of [[], [null], [0], [0, 0], [5], [-5, 0, 12]]) {
    const scale = chartScale(values);
    assert.ok(Number.isFinite(scale.low) && Number.isFinite(scale.high));
    assert.ok(scale.high > scale.low);
    assert.ok(scale.ticks.every(Number.isFinite));
    for (const value of values) if (value !== null) assert.ok(value >= scale.low && value <= scale.high);
  }
});
