import assert from 'node:assert/strict';
import test from 'node:test';
import { TRUCK_LABEL, truckFund } from '../src/lib/truck-fund';
import type { MetricEntry } from '../src/lib/dashboard';

const entry = (measured_on: string, value: number, over: Partial<MetricEntry> = {}): MetricEntry => ({ id: measured_on + value, venture: 'exterior', label: TRUCK_LABEL, value, unit: 'USD', measured_on, note: '', ...over });

test('no balance logged means unknown, not zero', () => {
  const f = truckFund([], '2026-10-27');
  assert.equal(f.known, false);
  assert.equal(f.balance, null);
  assert.equal(f.perWeekNeeded, null);
  assert.ok(f.daysLeft > 150);
});

test('only exterior truck-fund entries count', () => {
  const f = truckFund([entry('2026-10-27', 1995), entry('2026-10-28', 99999, { label: 'Something else' }), entry('2026-10-29', 5, { venture: 'solutions' })], '2026-10-27');
  assert.equal(f.balance, 1995);
});

test('what is still needed per week and per month to reach the deadline', () => {
  const f = truckFund([entry('2026-10-27', 2000)], '2026-10-27', 20000, '2027-03-23'); // 147 days = 21 weeks
  assert.equal(f.remaining, 18000);
  assert.equal(f.daysLeft, 147);
  assert.ok(Math.abs((f.perWeekNeeded ?? 0) - 18000 / 21) < 0.001);
  assert.ok(Math.abs((f.perMonthNeeded ?? 0) - (18000 / 21) * 52 / 12) < 0.001);
  assert.equal(f.weeklyRate, null);
  assert.equal(f.onTrack, null);
});

test('projects a finish date from the logged growth rate', () => {
  const f = truckFund([entry('2026-10-01', 1000), entry('2026-10-29', 5000)], '2026-10-29', 20000, '2027-04-01');
  assert.equal(f.weeklyRate, 1000); // 4000 over 28 days
  assert.equal(f.projectedDate, '2027-02-11'); // 15000 / 1000 per week = 15 weeks (105 days) from Oct 29
  assert.equal(f.onTrack, true);
});

test('behind pace is reported as not on track', () => {
  const f = truckFund([entry('2026-10-01', 1000), entry('2026-10-29', 1280)], '2026-10-29', 20000, '2027-04-01');
  assert.equal(f.onTrack, false);
});

test('a reached goal is on track with nothing left to save, and an overshoot caps the bar', () => {
  const f = truckFund([entry('2027-02-01', 21000)], '2027-02-01');
  assert.equal(f.remaining, 0);
  assert.equal(f.perWeekNeeded, 0);
  assert.equal(f.percent, 100);
  assert.equal(f.onTrack, true);
});

test('past the deadline the whole remainder is shown as needed now', () => {
  const f = truckFund([entry('2027-04-10', 15000)], '2027-04-10');
  assert.equal(f.daysLeft, 0);
  assert.equal(f.perWeekNeeded, 5000);
});
