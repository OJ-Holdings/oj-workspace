import { centralWeek, checkinState, scoreFrom, workBusinessIds, type WeekScore, type WorkBusiness, type WorkData, type WorkSession } from './work';

// Everything in this file is fictional and is shown only at /preview, where the
// screen is labelled "Sample workspace". The live leaderboard never reads it:
// live points come from oj_work_scores in the database.

export const previewMe = 'preview-oscar';
const jacob = 'preview-jacob';
const HOUR = 3_600_000;

/** Eight finished weeks and the current one. The last two are rebuilt from the sample sessions below. */
export function sampleWork(now: Date): WorkData {
  const nowMs = now.getTime();
  const current = centralWeek(nowMs);
  const weeks = [current];
  for (let i = 0; i < 8; i++) weeks.unshift(centralWeek(Date.parse(weeks[0].startsAt) - HOUR));
  // [Oscar minutes, Oscar tasks, Jacob minutes, Jacob tasks] for the seven older weeks. The minutes of
  // last week and this week are left at zero here and rebuilt from the sample sessions by recount().
  const elapsed = (nowMs - Date.parse(current.startsAt)) / (7 * 24 * HOUR);
  const counts: [number, number, number, number][] = [
    [1310, 3, 1185, 4], [1460, 5, 1520, 3], [990, 2, 1240, 4], [1605, 4, 1390, 5], [1275, 6, 1330, 2], [1500, 3, 1420, 3], [1190, 4, 1265, 3],
    [0, 4, 0, 3], [0, Math.min(3, Math.floor(elapsed * 5)), 0, 1],
  ];
  const rows: WeekScore[] = weeks.flatMap((w, i) => ([[previewMe, counts[i][0], counts[i][1]], [jacob, counts[i][2], counts[i][3]]] as const).map(([id, minutes, tasks]) => {
    const seconds = minutes * 60;
    const split = { exterior: Math.round(seconds * 0.5), solutions: Math.round(seconds * 0.3) };
    return {
      week_start: w.weekStart, starts_at: w.startsAt, ends_at: w.endsAt, user_id: id, worked_seconds: seconds, ...scoreFrom(seconds, tasks), tasks, task_ids: [],
      by_business: seconds ? { ...split, general: seconds - split.exterior - split.solutions } : {}, won: false,
    };
  }));

  const lastStart = Date.parse(weeks[weeks.length - 2].startsAt), thisStart = Date.parse(current.startsAt);
  const at = (weekStart: number, day: number, hour: number) => new Date(weekStart + (day * 24 + hour) * HOUR).toISOString();
  const session = (id: string, user: string, business: WorkBusiness, start: string, end: string, extra: Partial<WorkSession> = {}): WorkSession =>
    ({ id, user_id: user, business, started_at: start, ended_at: end, last_checkin_at: end, ended_reason: 'manual', note: '', ...extra });
  const sessions: WorkSession[] = [
    session('s1', previewMe, 'exterior', at(lastStart, 0, 9), at(lastStart, 0, 12.5)),
    session('s2', previewMe, 'solutions', at(lastStart, 1, 13), at(lastStart, 1, 17.25)),
    session('s3', previewMe, 'general', at(lastStart, 3, 8.5), at(lastStart, 3, 11), { ended_reason: 'edited', note: 'Forgot to stop the timer before lunch.' }),
    session('s4', previewMe, 'exterior', at(lastStart, 5, 10), at(lastStart, 5, 14.75)),
    session('s5', jacob, 'essentials', at(lastStart, 0, 10), at(lastStart, 0, 14)),
    session('s6', jacob, 'solutions', at(lastStart, 2, 9), at(lastStart, 2, 10), { ended_reason: 'idle' }),
    session('s7', jacob, 'solutions', at(lastStart, 4, 13), at(lastStart, 4, 18)),
    session('s8', jacob, 'general', at(lastStart, 6, 15), at(lastStart, 6, 16.75)),
  ];
  // This week: whatever fits before now, then a timer Jacob started 38 minutes ago.
  const plan: [string, WorkBusiness, number, number, number][] = [[previewMe, 'exterior', 0, 8, 11.5], [jacob, 'solutions', 0, 9, 12], [previewMe, 'solutions', 1, 13, 16], [jacob, 'essentials', 1, 10, 13.5], [previewMe, 'exterior', 2, 8.5, 12], [jacob, 'general', 3, 9, 11], [previewMe, 'general', 4, 10, 12.25]];
  plan.forEach(([user, business, day, from, to], i) => {
    if (Date.parse(at(thisStart, day, to)) < nowMs - HOUR) sessions.push(session(`t${i}`, user, business, at(thisStart, day, from), at(thisStart, day, to)));
  });
  const running = new Date(Math.max(thisStart, nowMs - 38 * 60_000)).toISOString();
  sessions.push({ id: 'run-jacob', user_id: jacob, business: 'solutions', started_at: running, ended_at: null, last_checkin_at: running, ended_reason: null, note: '' });

  return recount({ asOf: now.toISOString(), me: previewMe, partners: [{ id: previewMe, name: 'Oscar' }, { id: jacob, name: 'Jacob' }], weeks: rows, sessions }, nowMs);
}

/**
 * Sample workspace only: rebuilds the figures for the weeks the sample sessions
 * fall in, after a change made in this browser. The live leaderboard never
 * does this; the database works out live points.
 */
export function recount(data: WorkData, nowMs: number): WorkData {
  const starts = [...new Set(data.weeks.map(w => w.week_start))].sort().slice(-2);
  const weeks = data.weeks.map(row => {
    if (!starts.includes(row.week_start)) return row;
    const from = Date.parse(row.starts_at), to = Date.parse(row.ends_at);
    const by: Partial<Record<WorkBusiness, number>> = {};
    for (const s of data.sessions.filter(x => x.user_id === row.user_id)) {
      const end = s.ended_at ? Date.parse(s.ended_at) : checkinState(s, nowMs).phase === 'expired' ? Date.parse(s.last_checkin_at) : nowMs;
      const seconds = (Math.min(end, to) - Math.max(Date.parse(s.started_at), from)) / 1000;
      if (seconds > 0) by[s.business] = (by[s.business] ?? 0) + seconds;
    }
    const total = Math.floor(Object.values(by).reduce((a, b) => a + (b ?? 0), 0));
    return { ...row, worked_seconds: total, ...scoreFrom(total, row.tasks), by_business: Object.fromEntries(workBusinessIds.filter(b => by[b]).map(b => [b, Math.floor(by[b]!)])) };
  });
  // A finished week goes to whoever alone has the most points.
  const won = weeks.map(r => {
    const rows = weeks.filter(w => w.week_start === r.week_start);
    const top = Math.max(...rows.map(x => x.points));
    return { ...r, won: Date.parse(r.ends_at) <= nowMs && top > 0 && r.points === top && rows.filter(x => x.points === top).length === 1 };
  });
  return { ...data, weeks: won, asOf: new Date(nowMs).toISOString() };
}
