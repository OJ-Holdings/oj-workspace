import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ventureList } from '../src/lib/ventures';
import {
  checkinState, clock, editProblem, hoursMinutes, leaderboardView, liveSeconds, scoreFrom, weekLabel, workBusinesses,
  type WeekScore, type WorkData, type WorkSession,
} from '../src/lib/work';
import { previewMe, recount, sampleWork } from '../src/lib/sample-work';

const MIN = 60_000, HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const oscar = 'u-oscar', jacob = 'u-jacob';

// Four weeks ending with the current one, which started at `weekStart`.
const weekStart = Date.parse('2026-10-12T05:00:00Z');
const weeks = [-3, -2, -1, 0].map(k => ({ start: new Date(weekStart + k * 7 * 24 * HOUR), key: ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'][k + 3] }));
function row(k: number, user: string, seconds: number, tasks: number, won = false): WeekScore {
  const w = weeks[k + 3];
  const { hours, points } = scoreFrom(seconds, tasks);
  return { week_start: w.key, starts_at: iso(w.start.getTime()), ends_at: iso(w.start.getTime() + 7 * 24 * HOUR), user_id: user, worked_seconds: seconds, hours, tasks, task_ids: [], points, by_business: seconds ? { exterior: seconds } : {}, won };
}
const running = (user: string, startedAgo: number, checkinAgo: number, now: number, business: WorkSession['business'] = 'solutions'): WorkSession =>
  ({ id: `run-${user}`, user_id: user, business, started_at: iso(now - startedAgo), last_checkin_at: iso(now - checkinAgo), ended_at: null, ended_reason: null, note: '' });
function data(rows: WeekScore[], asOf: number, sessions: WorkSession[] = [], me = jacob): WorkData {
  return { asOf: iso(asOf), me, partners: [{ id: oscar, name: 'Oscar' }, { id: jacob, name: 'Jacob' }], weeks: rows, sessions };
}

test('the check-in is due at 60 minutes and the timer ends after 70', () => {
  const t0 = Date.parse('2026-10-14T15:00:00Z');
  const at = (minutes: number) => checkinState({ last_checkin_at: iso(t0) }, t0 + minutes * MIN).phase;
  assert.equal(at(0), 'ok');
  assert.equal(at(59.99), 'ok');
  assert.equal(at(60), 'due');
  assert.equal(at(70), 'due');
  assert.equal(at(70.01), 'expired');
  const s = checkinState({ last_checkin_at: iso(t0) }, t0);
  assert.equal(s.dueAt - t0, 60 * MIN);
  assert.equal(s.endsAt - t0, 70 * MIN);
});

test('a running timer moves its score forward between loads, and stops counting when it should', () => {
  const now = weekStart + 30 * HOUR;
  const asOf = now - 90_000; // read 90 seconds ago
  const r = row(0, jacob, 3600, 0);
  const run = running(jacob, 20 * MIN, 20 * MIN, now);
  assert.equal(liveSeconds(r, run, asOf, now), 3690);
  assert.equal(liveSeconds(r, undefined, asOf, now), 3600, 'not running: the database figure');
  // A check-in missed since the load: no more time is added (the next load drops it).
  const missed = running(jacob, 3 * HOUR, 71 * MIN, now);
  assert.equal(liveSeconds(r, missed, asOf, now), 3600);
  // A row for a week the load was not in is never moved.
  assert.equal(liveSeconds(row(-1, jacob, 100, 0), run, asOf, now), 100);
  // Past the end of the week, the old week stops growing.
  const end = weekStart + 7 * 24 * HOUR;
  assert.equal(liveSeconds(r, running(jacob, 10 * MIN, 10 * MIN, end - MIN), end - MIN, end + 5 * MIN), 3660);
});

test('the leaderboard: leader, gap, ties, weeks won and streaks', async t => {
  const now = weekStart + 50 * HOUR;
  const history = [
    row(-3, oscar, 7200, 1, true), row(-3, jacob, 3600, 0),      // Oscar won
    row(-2, oscar, 3600, 0), row(-2, jacob, 7200, 2, true),      // Jacob won
    row(-1, oscar, 3600, 1), row(-1, jacob, 9000, 3, true),      // Jacob won: a two-week streak
  ];

  await t.test('the sole top score leads, by the gap to the next; you are listed first', () => {
    const v = leaderboardView(data([...history, row(0, oscar, 4 * 3600, 2), row(0, jacob, 3 * 3600, 1)], now), now);
    assert.deepEqual(v.people.map(p => p.name), ['Jacob', 'Oscar']);
    const [j, o] = v.people;
    assert.equal(v.leader, oscar);
    assert.equal(o.isLeader, true);
    assert.equal(o.points, 10);
    assert.equal(o.gap, 4);         // 10 vs 6
    assert.equal(j.gap, 4);         // 4 behind
    assert.equal(j.weeksWon, 2);
    assert.equal(j.streak, 2);
    assert.equal(o.weeksWon, 1);
    assert.equal(o.streak, 0);
    assert.equal(v.lastWeek?.outcome, 'won');
    assert.equal(v.lastWeek?.winner?.name, 'Jacob');
    assert.equal(v.lastWeek?.label, 'Oct 5 - 11');
    assert.deepEqual(v.history.map(h => h.weekStart), ['2026-10-05', '2026-09-28', '2026-09-21']);
    assert.equal(v.week?.label, 'Oct 12 - 18');
  });

  await t.test('level at the top: nobody leads', () => {
    const v = leaderboardView(data([...history, row(0, oscar, 3600, 1), row(0, jacob, 3600, 1)], now), now);
    assert.equal(v.leader, null);
    assert.equal(v.tied, true);
    assert.ok(v.people.every(p => !p.isLeader && p.gap === 0));
  });

  await t.test('nobody leads a week with no points', () => {
    const v = leaderboardView(data([row(0, oscar, 0, 0), row(0, jacob, 0, 0)], now), now);
    assert.equal(v.leader, null);
    assert.equal(v.tied, false);
    assert.equal(v.lastWeek, null);
  });

  await t.test('a tie or an empty week ends a streak, and last week reads as a tie or as empty', () => {
    const tie = [row(-2, jacob, 7200, 0, true), row(-2, oscar, 0, 0), row(-1, oscar, 3600, 0), row(-1, jacob, 3600, 0), row(0, oscar, 0, 0), row(0, jacob, 0, 0)];
    const v = leaderboardView(data(tie, now), now);
    assert.equal(v.people.find(p => p.id === jacob)?.streak, 0);
    assert.equal(v.people.find(p => p.id === jacob)?.weeksWon, 1);
    assert.equal(v.lastWeek?.outcome, 'tie');
    const empty = [row(-1, oscar, 0, 0), row(-1, jacob, 0, 0), row(0, oscar, 0, 0), row(0, jacob, 0, 0)];
    assert.equal(leaderboardView(data(empty, now), now).lastWeek?.outcome, 'empty');
  });

  await t.test("a partner's running timer moves their points and their running business live", () => {
    const asOf = now - 30 * MIN;
    const v = leaderboardView(data([row(0, oscar, 3600, 0), row(0, jacob, 3000, 0)], asOf, [running(jacob, 40 * MIN, 40 * MIN, now)]), now);
    const j = v.people.find(p => p.id === jacob)!;
    assert.equal(j.seconds, 3000 + 30 * 60);
    assert.equal(j.points, scoreFrom(4800, 0).points);
    assert.equal(v.leader, jacob);
    assert.deepEqual(j.byBusiness, [{ business: 'exterior', seconds: 3000 }, { business: 'solutions', seconds: 1800 }]);
    assert.equal(j.running?.business, 'solutions');
  });

  await t.test('a timer whose check-in ran out is not shown as running and stops adding time', () => {
    const asOf = now - 5 * MIN;
    const v = leaderboardView(data([row(0, oscar, 3600, 0), row(0, jacob, 3000, 0)], asOf, [running(jacob, 3 * HOUR, 72 * MIN, now)]), now);
    const j = v.people.find(p => p.id === jacob)!;
    assert.equal(j.running, null);
    assert.equal(j.seconds, 3000);
  });
});

test('labels and durations', () => {
  assert.equal(weekLabel('2026-10-12'), 'Oct 12 - 18');
  assert.equal(weekLabel('2026-09-28'), 'Sep 28 - Oct 4');
  assert.equal(weekLabel('2026-12-28'), 'Dec 28 - Jan 3');
  assert.equal(weekLabel('2026-03-02'), 'Mar 2 - 8');
  assert.equal(clock(0), '0:00:00');
  assert.equal(clock(3909.9), '1:05:09');
  assert.equal(clock(-5), '0:00:00');
  assert.equal(hoursMinutes(59), '0m');
  assert.equal(hoursMinutes(45 * 60), '45m');
  assert.equal(hoursMinutes(2 * 3600 + 5 * 60), '2h 05m');
  assert.deepEqual(workBusinesses.map(b => b.label), ['General', ...ventureList.map(v => v.short)]);
});

test('an edit is checked the way the database checks it', () => {
  const now = Date.parse('2026-10-14T20:00:00Z');
  const ok = { id: 'x', business: 'exterior' as const, started_at: '2026-10-14T14:00:00Z', ended_at: '2026-10-14T16:00:00Z', note: 'Forgot to stop it' };
  assert.equal(editProblem(ok, now), null);
  assert.match(editProblem({ ...ok, note: '  ' }, now)!, /note/);
  assert.match(editProblem({ ...ok, note: 'x'.repeat(501) }, now)!, /500/);
  assert.match(editProblem({ ...ok, ended_at: '2026-10-14T13:00:00Z' }, now)!, /end after/);
  assert.match(editProblem({ ...ok, ended_at: '2026-10-14T21:00:00Z' }, now)!, /future/);
  assert.match(editProblem({ ...ok, started_at: '2026-10-13T15:00:00Z' }, now)!, /24 hours/);
  assert.match(editProblem({ ...ok, business: 'unknown' as never }, now)!, /what the time was for/);
  assert.match(editProblem({ ...ok, started_at: 'nonsense' }, now)!, /valid/);
});

test('the sample workspace is fictional, consistent, and changes only in the browser', () => {
  const now = new Date('2026-10-15T18:00:00Z');
  const d = sampleWork(now);
  assert.equal(d.me, previewMe);
  assert.ok(d.partners.every(p => p.id.startsWith('preview-')));
  assert.equal(new Set(d.weeks.map(w => w.week_start)).size, 9);
  assert.equal(d.weeks.at(-1)?.week_start, '2026-10-12');
  // Last week and this week are exactly the sum of their sample sessions.
  for (const r of d.weeks.filter(w => w.week_start >= '2026-10-05')) {
    const from = Date.parse(r.starts_at), to = Date.parse(r.ends_at);
    const sum = d.sessions.filter(s => s.user_id === r.user_id).reduce((acc, s) => acc + Math.max(0, (Math.min(s.ended_at ? Date.parse(s.ended_at) : now.getTime(), to) - Math.max(Date.parse(s.started_at), from)) / 1000), 0);
    assert.equal(r.worked_seconds, Math.floor(sum), `${r.week_start} ${r.user_id}`);
    assert.deepEqual({ hours: r.hours, points: r.points }, { hours: scoreFrom(r.worked_seconds, r.tasks).hours, points: scoreFrom(r.worked_seconds, r.tasks).points });
  }
  // A week is won by the sole top score once it has ended.
  for (const start of new Set(d.weeks.map(w => w.week_start))) {
    const rows = d.weeks.filter(w => w.week_start === start);
    const top = Math.max(...rows.map(r => r.points));
    const ended = Date.parse(rows[0].ends_at) <= now.getTime();
    for (const r of rows) assert.equal(r.won, ended && r.points === top && rows.filter(x => x.points === top).length === 1, start);
  }
  // Jacob's sample timer is running; stopping a timer in the preview adds its time.
  assert.ok(d.sessions.some(s => s.user_id !== previewMe && !s.ended_at));
  const later = now.getTime() + 30 * MIN;
  const stopped = recount({ ...d, sessions: d.sessions.map(s => s.ended_at ? s : { ...s, ended_at: iso(later), ended_reason: 'manual' as const }) }, later);
  const jacobNow = (x: WorkData) => x.weeks.find(w => w.week_start === '2026-10-12' && w.user_id !== previewMe)!.worked_seconds;
  assert.equal(jacobNow(stopped) - jacobNow(d), 30 * 60);
});
