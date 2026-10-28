import assert from 'node:assert/strict';
import test from 'node:test';
import { addMonths, planClashes, planVisits } from '../src/lib/commercial-booking';

test('adding months keeps the day, or the last day of a shorter month, and crosses years', () => {
  assert.equal(addMonths('2026-11-03', 3), '2027-02-03');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-10-15', 6), '2027-04-15');
  assert.equal(addMonths('2026-12-01', 1), '2027-01-01');
});

test('a one-time job is one visit, whatever the visit count says', () => {
  assert.deepEqual(planVisits('2026-11-03', 'once', 9, 1), [{ visit: 1, date: '2026-11-03' }]);
});

test('recurring visits step by the frequency and each is its own visit number', () => {
  assert.deepEqual(planVisits('2026-11-03', 'quarterly', 3, 1), [{ visit: 1, date: '2026-11-03' }, { visit: 2, date: '2027-02-03' }, { visit: 3, date: '2027-05-03' }]);
  assert.deepEqual(planVisits('2026-11-03', 'semiannual', 2, 1).map(d => d.date), ['2026-11-03', '2027-05-03']);
  assert.equal(planVisits('2026-11-03', 'monthly', 99, 1).length, 12);
});

test('a visit that would start on a Sunday starts on the Monday; a big building runs on consecutive working days, skipping Sundays', () => {
  assert.equal(planVisits('2026-11-01', 'once', 1, 1)[0].date, '2026-11-02');
  assert.deepEqual(planVisits('2026-11-05', 'once', 1, 3).map(d => d.date), ['2026-11-05', '2026-11-06', '2026-11-07']);
  assert.deepEqual(planVisits('2026-11-06', 'once', 1, 3).map(d => d.date), ['2026-11-06', '2026-11-07', '2026-11-09']);
  assert.equal(planVisits('2026-11-02', 'once', 1, 50).length, 5);
});

test('multi-day recurring plans number their days under the right visit', () => {
  const p = planVisits('2026-11-05', 'monthly', 2, 2);
  assert.deepEqual(p.map(d => [d.visit, d.date]), [[1, '2026-11-05'], [1, '2026-11-06'], [2, '2026-12-05'], [2, '2026-12-07']]);
});

test('clashes: days in the past, and days where the time block overlaps a job already booked', () => {
  const plan = planVisits('2026-11-05', 'once', 1, 3);
  const bookings = [{ id: 'a', date: '2026-11-06', time_block: '9-11', status: 'confirmed' }, { id: 'b', date: '2026-11-07', time_block: '9-11', status: 'denied' }];
  assert.deepEqual(planClashes(plan, '8-4', bookings, '2026-11-05'), [{ date: '2026-11-06', reason: 'taken' }]);
  assert.deepEqual(planClashes(plan, '8-4', [], '2026-11-06'), [{ date: '2026-11-05', reason: 'past' }]);
  assert.deepEqual(planClashes(plan, '10-1', bookings, '2026-11-05'), [{ date: '2026-11-06', reason: 'taken' }], 'a partial overlap clashes');
  assert.deepEqual(planClashes(plan, '12-4', bookings, '2026-11-05'), [], 'noon to 4 PM does not overlap 9 to 11 AM');
  assert.deepEqual(planClashes(plan, '6-7', bookings, '2026-11-05'), []);
});
