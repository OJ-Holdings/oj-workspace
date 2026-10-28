import assert from 'node:assert/strict';
import test from 'node:test';
import { ago, dayLabel, level, mergeBursts, notificationEvents, plainLog, scoreboard, streak, workXp, type PulseEvent } from '../src/lib/pulse';

const ev = (o: Partial<PulseEvent>): PulseEvent => ({ id: Math.random().toString(36), at: '2026-10-28T15:00:00Z', who: 'Oscar', kind: 'bank', text: 'posted a bank transaction', xp: 3, venture: null, ...o });

test('compact notifications show customer events and remain bounded', () => {
  const events = [ev({ kind: 'task-edit' }), ev({ kind: 'lead' }), ev({ kind: 'reply' }), ev({ kind: 'customer' })];
  assert.deepEqual(notificationEvents(events, 2).map(e => e.kind), ['lead', 'reply']);
  assert.equal(notificationEvents(events, 0).length, 0);
  assert.equal(notificationEvents([], 8).length, 0);
});

test('a run of small things by one person becomes one line with a count, even with someone else in between', () => {
  const rows = mergeBursts([
    ev({ at: '2026-10-28T15:00:00Z', group: 'bank', many: 'posted {n} bank transactions to the books' }),
    ev({ at: '2026-10-28T15:10:00Z', group: 'bank', many: 'posted {n} bank transactions to the books' }),
    ev({ at: '2026-10-28T15:05:00Z', who: 'Jacob', kind: 'task-done', text: 'finished "Call client"', xp: 50 }),
    ev({ at: '2026-10-28T15:20:00Z', group: 'bank', many: 'posted {n} bank transactions to the books' }),
    ev({ at: '2026-10-28T12:00:00Z', group: 'bank', many: 'posted {n} bank transactions to the books' }),
  ]);
  assert.deepEqual(rows.map(r => [r.who, r.text, r.count ?? 1, r.xp]), [
    ['Oscar', 'posted 3 bank transactions to the books', 3, 9],
    ['Jacob', 'finished "Call client"', 1, 50],
    ['Oscar', 'posted a bank transaction', 1, 3],
  ]);
});

test('bursts do not merge across Central midnight and inflate today’s score', () => {
  const rows = mergeBursts([
    ev({ at: '2026-10-29T05:05:00Z', group: 'bank', many: 'posted {n}' }),
    ev({ at: '2026-10-29T04:55:00Z', group: 'bank', many: 'posted {n}' }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(scoreboard(rows, ['Oscar'], '2026-10-29T06:00:00Z')[0].today, 3);
});

test('levels climb 100, 300, 600 points and carry a title', () => {
  assert.deepEqual([level(0).level, level(99).level, level(100).level, level(299).level, level(300).level, level(600).level], [1, 1, 2, 2, 3, 4]);
  assert.equal(level(0).title, 'Rookie');
  assert.deepEqual([level(150).into, level(150).span, level(150).toNext], [50, 200, 150]);
  assert.equal(level(10_000_000).title, 'Legend');
});

test('a streak counts days in a row and survives until today is over', () => {
  assert.equal(streak(new Set(['2026-10-26', '2026-10-27', '2026-10-28']), '2026-10-28'), 3);
  assert.equal(streak(new Set(['2026-10-26', '2026-10-27']), '2026-10-28'), 2, 'nothing yet today, the streak is still alive');
  assert.equal(streak(new Set(['2026-10-25', '2026-10-27']), '2026-10-28'), 1);
  assert.equal(streak(new Set(), '2026-10-28'), 0);
});

test('scoreboard: today, week, streak and level per founder; the email engine never scores', () => {
  const now = '2026-10-28T20:00:00Z';
  const board = scoreboard([
    ev({ who: 'Oscar', kind: 'payment', xp: 75, at: '2026-10-28T18:00:00Z' }),
    ev({ who: 'Oscar', kind: 'task-done', xp: 50, at: '2026-10-27T18:00:00Z' }),
    ev({ who: 'Jacob', kind: 'booking', xp: 40, at: '2026-10-28T16:00:00Z', count: 2 }),
    ev({ who: 'Email engine', kind: 'email', xp: 0, at: '2026-10-28T16:00:00Z' }),
  ], ['Oscar', 'Jacob'], now);
  assert.deepEqual(board.map(p => [p.name, p.xp, p.today, p.week, p.streak, p.lvl.level, p.things]), [['Oscar', 125, 75, 125, 2, 2, 1], ['Jacob', 40, 40, 40, 1, 1, 2]]);
  assert.equal(board[0].best?.kind, 'payment');
});

test('Central time decides the day, so late evening work is not counted as tomorrow', () => {
  assert.equal(dayLabel('2026-10-29T03:30:00Z', '2026-10-29T04:00:00Z'), 'Today', '10:30 PM Central on the 28th, seen at 11 PM');
  assert.equal(dayLabel('2026-10-28T03:30:00Z', '2026-10-29T04:00:00Z'), 'Yesterday');
  assert.equal(ago('2026-10-28T15:00:00Z', '2026-10-28T15:00:30Z'), 'just now');
  assert.equal(ago('2026-10-28T13:00:00Z', '2026-10-28T15:00:00Z'), '2h ago');
  assert.deepEqual([workXp(29), workXp(30), workXp(95)], [0, 10, 30]);
});

test('the Exterior log reads as plain words', () => {
  assert.deepEqual(plainLog('lead_created', 'Added new lead: Example Client - House Washing', 'Example Client'), { kind: 'lead', text: 'added a new lead: Example Client, House Washing' });
  assert.deepEqual(plainLog('status_changed', 'Marked Example as completed', 'Example'), { kind: 'job-done', text: 'finished the job for Example' });
  assert.deepEqual(plainLog('status_changed', 'Marked Example as following_up', 'Example'), { kind: 'lead-edit', text: 'moved Example to following up' });
  assert.deepEqual(plainLog('lead_updated', 'Updated Example: job_revenue, job_cost, notes', 'Example'), { kind: 'lead-edit', text: "updated Example's revenue, cost, notes" });
  assert.deepEqual(plainLog('booking_manual', 'Booked Example Client - 2026-11-11 10:30-12', 'Example Client'), { kind: 'booking', text: 'booked Example Client for Wed, Nov 11 at 10:30' });
  assert.deepEqual(plainLog('booking_deleted', 'Deleted booking for Example Client - 2026-10-29 10-12', 'Example Client'), { kind: 'booking-change', text: 'cancelled Example Client on Thu, Oct 29 at 10:00' });
  assert.equal(plainLog('dedup_run', 'Deduplication complete: 3 duplicate leads removed', null).text, 'cleaned up duplicates: 3 duplicate leads removed');
});
