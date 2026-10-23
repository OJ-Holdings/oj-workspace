import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExtBooking } from '../src/lib/exterior';
import {
  addBookingDays, bookingWorkCounts, bookingWorkDescriptions, bookingWorkFocuses,
  bookingWorkLabels, matchesBookingWorkFocus, sortBookingsForWork,
} from '../src/lib/exterior-booking-workflow';

const booking = (id: string, date: string, status: string | null = 'confirmed', time_block: string | null = '9-12'): ExtBooking =>
  ({ id, date, status, time_block, lead_id: null });

test('each queue counts only loaded booking rows and exact statuses/dates', () => {
  const rows = [
    booking('today', '2026-10-23'),
    booking('pending', '2026-10-24', 'pending_approval'),
    booking('next', '2026-10-30'),
    booking('later', '2026-10-31'),
    booking('past', '2026-10-22'),
    booking('denied', '2026-10-25', 'denied'),
    booking('unknown', '2026-10-25', null),
  ];
  assert.deepEqual(bookingWorkCounts(rows, '2026-10-23'), {
    upcoming: 5, today: 1, 'next-seven': 3, pending: 1, past: 1, denied: 1,
  });
  assert.equal(bookingWorkFocuses.length, 6);
  for (const focus of bookingWorkFocuses) {
    assert.ok(bookingWorkLabels[focus]);
    assert.ok(bookingWorkDescriptions[focus]);
  }
  assert.equal(rows.length, 7, 'queue operations must not mutate source rows');
});

test('pending does not assert confirmed; past does not assert completed', () => {
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-23', 'pending_approval'), 'pending', '2026-10-23'), true);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-23', 'confirmed'), 'pending', '2026-10-23'), false);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-22', 'pending_approval'), 'pending', '2026-10-23'), false);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-22', 'confirmed'), 'past', '2026-10-23'), true);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-25', 'denied'), 'upcoming', '2026-10-23'), false);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-25', 'denied'), 'denied', '2026-10-23'), true);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-25', null), 'upcoming', '2026-10-23'), true);
});

test('seven calendar days is inclusive at boundary, excludes today and day eight', () => {
  const today = '2026-10-23';
  assert.equal(matchesBookingWorkFocus(booking('x', today), 'next-seven', today), false);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-24'), 'next-seven', today), true);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-30'), 'next-seven', today), true);
  assert.equal(matchesBookingWorkFocus(booking('x', '2026-10-31'), 'next-seven', today), false);
  assert.equal(addBookingDays('2026-10-30', 7), '2026-11-06');
  assert.equal(addBookingDays('2026-03-07', 2), '2026-03-09', 'DST transition must not shift a date');
  assert.equal(addBookingDays('2026-12-30', 3), '2027-01-02');
});

test('booking order uses recorded day/time and stable identity without source mutation', () => {
  const rows = [
    booking('late', '2026-10-25', 'confirmed', '4-6'),
    booking('missing', '2026-10-24', null, null),
    booking('early', '2026-10-25', 'confirmed', '9-12'),
    booking('tie-b', '2026-10-25', null, '9-12'),
    booking('tie-a', '2026-10-25', null, '9-12'),
  ];
  assert.deepEqual(sortBookingsForWork(rows).map(b => b.id), ['missing', 'early', 'tie-a', 'tie-b', 'late']);
  assert.deepEqual(sortBookingsForWork(rows, true).map(b => b.id), ['early', 'tie-a', 'tie-b', 'late', 'missing']);
  assert.deepEqual(rows.map(b => b.id), ['late', 'missing', 'early', 'tie-b', 'tie-a']);
});

test('denied, unknown and orphan records remain visible without invented lead or field work', () => {
  const rows = [
    booking('denied', '2026-10-23', 'denied'),
    booking('orphan', '2026-10-24', null, null),
    booking('past', '2026-10-18', 'confirmed'),
  ];
  const count = bookingWorkCounts(rows, '2026-10-23');
  assert.equal(count.denied, 1);
  assert.equal(count.upcoming, 1);
  assert.equal(count.past, 1);
});
