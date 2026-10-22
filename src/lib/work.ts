import { contentPersistenceEnabled, ventureIds, ventures } from './ventures';

// The weekly work leaderboard. Points are worked out by the database, in
// oj_work_scores (supabase/schemas/work-leaderboard.sql): that is the record.
// This file holds the shapes, the timer's check-in timing, and the small
// amount of arithmetic needed to move a running timer's figure forward
// between loads. tests/work-leaderboard.test.ts checks that arithmetic
// against the database's own output.

/** What a timer can be logged against: general work, or any business in ventures.ts. */
export const workBusinessIds = ['general', ...ventureIds] as const;
export type WorkBusiness = typeof workBusinessIds[number];
export const isWorkBusiness = (value: unknown): value is WorkBusiness => typeof value === 'string' && (workBusinessIds as readonly string[]).includes(value) && (value !== 'content' || contentPersistenceEnabled);
export const workBusinessLabel = (b: WorkBusiness) => b === 'general' ? 'General' : ventures[b].short;
export const workBusinessColor = (b: WorkBusiness) => `var(--c-${b === 'general' ? 'shared' : b})`;
export const workBusinesses = workBusinessIds.filter(id => id !== 'content' || contentPersistenceEnabled).map(id => ({ id, label: workBusinessLabel(id) }));

/** "Still working?" is asked this long after the last check-in... */
export const CHECKIN_MINUTES = 60;
/** ...and if nobody answers within this much more, the timer ends at the last check-in. */
export const GRACE_MINUTES = 10;
export const TASK_POINTS = 3;
const MINUTE = 60_000;

export type EndedReason = 'manual' | 'idle' | 'edited';
export type WorkSession = {
  id: string; user_id: string; business: WorkBusiness;
  started_at: string; ended_at: string | null; last_checkin_at: string;
  ended_reason: EndedReason | null; note: string;
};
/** One row of oj_work_scores: one partner, one week. */
export type WeekScore = {
  week_start: string; starts_at: string; ends_at: string; user_id: string;
  worked_seconds: number; hours: number; tasks: number; task_ids: string[];
  points: number; by_business: Partial<Record<WorkBusiness, number>>; won: boolean;
};
export type Partner = { id: string; name: string };
export type WorkData = {
  /** Server time the figures were read at. Running timers are counted up to here. */
  asOf: string;
  me: string;
  partners: Partner[];
  /** Every week from the first recorded work to the current week, one row per partner. */
  weeks: WeekScore[];
  /** Running sessions, and every session that ended in roughly the last two weeks. */
  sessions: WorkSession[];
};

export type CheckinPhase = 'ok' | 'due' | 'expired';
/**
 * Where a running timer stands. 'due' from 60 minutes after the last check-in;
 * 'expired' once more than 70 minutes have passed, which is when the database
 * treats the timer as having ended at that check-in.
 */
export function checkinState(session: Pick<WorkSession, 'last_checkin_at'>, nowMs: number) {
  const lastCheckin = Date.parse(session.last_checkin_at);
  const dueAt = lastCheckin + CHECKIN_MINUTES * MINUTE;
  const endsAt = dueAt + GRACE_MINUTES * MINUTE;
  const phase: CheckinPhase = nowMs > endsAt ? 'expired' : nowMs >= dueAt ? 'due' : 'ok';
  return { phase, lastCheckin, dueAt, endsAt };
}

/** Hours and points the way oj_work_scores works them out: whole minutes, hours to 2 decimals, plus 3 per task. */
export function scoreFrom(workedSeconds: number, tasks: number) {
  const minutes = Math.floor(Math.max(0, workedSeconds) / 60);
  // minutes / 60 to two decimals, done in hundredths so floating point cannot round the wrong way.
  const hundredths = Math.round((minutes * 5) / 3);
  return { minutes, hours: hundredths / 100, points: (hundredths + tasks * TASK_POINTS * 100) / 100 };
}

/**
 * Seconds a partner has worked in `row`'s week as of `nowMs`. The row counts a
 * running timer up to `asOfMs`; this adds the time since, unless the timer has
 * missed its check-in (the next load drops that time) or the week has ended.
 */
export function liveSeconds(row: WeekScore, running: WorkSession | undefined, asOfMs: number, nowMs: number) {
  if (!running) return row.worked_seconds;
  const start = Date.parse(row.starts_at), end = Date.parse(row.ends_at);
  if (asOfMs < start || asOfMs >= end || Date.parse(running.started_at) > asOfMs) return row.worked_seconds;
  if (checkinState(running, asOfMs).phase === 'expired' || checkinState(running, nowMs).phase === 'expired') return row.worked_seconds;
  return row.worked_seconds + Math.max(0, (Math.min(nowMs, end) - asOfMs) / 1000);
}

export const runningSession = (data: WorkData, userId: string) => data.sessions.find(s => s.user_id === userId && !s.ended_at);

export type SessionEdit = { id: string; business: WorkBusiness; started_at: string; ended_at: string; note: string };
/** Sessions can be edited from this moment on: the start of last week, Monday 00:00 Central time. */
export const editableFrom = (nowMs: number) => Date.parse(centralWeek(Date.parse(centralWeek(nowMs).startsAt) - 3_600_000).startsAt);
/**
 * The same limits the database puts on an edit, checked first so the form can
 * say what is wrong. Returns the problem, or null. The database checks again,
 * and also refuses an edit that overlaps another of the same person's sessions.
 */
export function editProblem(edit: SessionEdit, nowMs: number): string | null {
  const start = Date.parse(edit.started_at), end = Date.parse(edit.ended_at);
  if (!isWorkBusiness(edit.business)) return 'Choose what the time was for.';
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Choose a valid start and end.';
  if (start < editableFrom(nowMs)) return "Only this week's and last week's sessions can be edited.";
  if (end <= start) return 'The session has to end after it starts.';
  if (end > nowMs + MINUTE) return 'A session cannot end in the future.';
  if (end - start > 24 * 60 * MINUTE) return 'A session can be at most 24 hours long.';
  if (typeof edit.note !== 'string' || !edit.note.trim()) return 'Add a note saying why you changed it.';
  if (edit.note.trim().length > 500) return 'Keep the note under 500 characters.';
  return null;
}

const centralParts = (ms: number) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), weekday: parts.weekday };
};
/** The UTC instant of midnight starting a calendar day in Central time (05:00Z in summer, 06:00Z in winter). */
function centralMidnight(y: number, m: number, d: number) {
  const day = new Date(Date.UTC(y, m - 1, d));
  for (const hour of [5, 6]) {
    const t = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour);
    const p = centralParts(t);
    if (p.hour === 0 && p.minute === 0 && p.d === day.getUTCDate()) return t;
  }
  throw new Error('Could not place midnight in Central time.');
}
/**
 * The leaderboard week (Monday 00:00 to the next Monday 00:00, Central time)
 * holding `ms`. Only the sample workspace needs this: live weeks come from the
 * database. Tests check it against the database for the clock changes.
 */
export function centralWeek(ms: number) {
  const p = centralParts(ms);
  const back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  const monday = new Date(Date.UTC(p.y, p.m - 1, p.d - back));
  const y = monday.getUTCFullYear(), m = monday.getUTCMonth() + 1, d = monday.getUTCDate();
  return {
    weekStart: monday.toISOString().slice(0, 10),
    startsAt: new Date(centralMidnight(y, m, d)).toISOString(),
    endsAt: new Date(centralMidnight(y, m, d + 7)).toISOString(),
  };
}

/** 'Oct 12 - 18', or 'Sep 28 - Oct 4' across a month, from a week's Monday ('YYYY-MM-DD'). */
export function weekLabel(weekStart: string) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, d)), last = new Date(Date.UTC(y, m - 1, d + 6));
  const month = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month(first)} ${first.getUTCDate()} - ${month(first) === month(last) ? '' : `${month(last)} `}${last.getUTCDate()}`;
}

/** 1:05:09 for the running timer. */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/** 2h 05m, or 45m under an hour. */
export function hoursMinutes(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
export const twoDecimals = (n: number) => n.toFixed(2);

export type PersonView = {
  id: string; name: string; isMe: boolean; running: WorkSession | null;
  seconds: number; hours: number; tasks: number; points: number;
  byBusiness: { business: WorkBusiness; seconds: number }[];
  isLeader: boolean;
  /** Leader: points ahead of the next person. Everyone else: points behind the leader. */
  gap: number;
  weeksWon: number; streak: number;
};
export type WeekResult = { weekStart: string; label: string; outcome: 'won' | 'tie' | 'empty'; winner: Partner | null; scores: { id: string; name: string; points: number; won: boolean }[] };
export type LeaderboardView = {
  week: { start: string; label: string; startsAt: string; endsAt: string } | null;
  people: PersonView[];
  leader: string | null;
  tied: boolean;
  lastWeek: WeekResult | null;
  /** Finished weeks, newest first. */
  history: WeekResult[];
};

const cents = (n: number) => Math.round(n * 100);

/** Everything the Home card shows, from the database's rows, moved forward to `nowMs` for running timers. */
export function leaderboardView(data: WorkData, nowMs: number): LeaderboardView {
  const asOfMs = Date.parse(data.asOf);
  const starts = [...new Set(data.weeks.map(w => w.week_start))].sort();
  const rowsOf = (start: string) => data.weeks.filter(w => w.week_start === start);
  const name = (id: string) => data.partners.find(p => p.id === id)?.name ?? 'Former partner';
  // The current week is the one the figures were read in; if it has ended since, the newest one.
  const currentStart = starts.find(s => { const r = rowsOf(s)[0]; return Date.parse(r.starts_at) <= asOfMs && asOfMs < Date.parse(r.ends_at); }) ?? starts.at(-1);
  const finished = starts.filter(s => Date.parse(rowsOf(s)[0].ends_at) <= asOfMs);

  const result = (start: string): WeekResult => {
    const rows = rowsOf(start);
    const winner = rows.find(r => r.won);
    const anyPoints = rows.some(r => r.points > 0);
    return {
      weekStart: start, label: weekLabel(start),
      outcome: winner ? 'won' : anyPoints ? 'tie' : 'empty',
      winner: winner ? { id: winner.user_id, name: name(winner.user_id) } : null,
      scores: data.partners.map(p => { const r = rows.find(x => x.user_id === p.id); return { id: p.id, name: p.name, points: r?.points ?? 0, won: !!r?.won }; }),
    };
  };
  const history = [...finished].reverse().map(result);

  const people: PersonView[] = data.partners.map(p => {
    const row = currentStart ? rowsOf(currentStart).find(r => r.user_id === p.id) : undefined;
    const running = runningSession(data, p.id) ?? null;
    const counting = running && checkinState(running, nowMs).phase !== 'expired' ? running : undefined;
    const seconds = row ? liveSeconds(row, counting, asOfMs, nowMs) : 0;
    const tasks = row?.tasks ?? 0;
    const { hours, points } = scoreFrom(seconds, tasks);
    const extra = row ? seconds - row.worked_seconds : 0;
    const byBusiness = workBusinessIds
      .map(business => ({ business, seconds: (row?.by_business[business] ?? 0) + (counting && counting.business === business ? extra : 0) }))
      .filter(b => b.seconds >= 60)
      .sort((a, b) => b.seconds - a.seconds);
    let streak = 0;
    for (const start of [...finished].reverse()) {
      if (rowsOf(start).find(r => r.user_id === p.id)?.won) streak++; else break;
    }
    const weeksWon = data.weeks.filter(w => w.user_id === p.id && w.won).length;
    return { id: p.id, name: p.name, isMe: p.id === data.me, running: counting ?? null, seconds, hours, tasks, points, byBusiness, isLeader: false, gap: 0, weeksWon, streak };
  });

  const top = Math.max(0, ...people.map(p => cents(p.points)));
  const atTop = people.filter(p => cents(p.points) === top);
  const leader = top > 0 && atTop.length === 1 ? atTop[0].id : null;
  const second = Math.max(0, ...people.filter(p => p.id !== leader).map(p => cents(p.points)));
  for (const p of people) {
    p.isLeader = p.id === leader;
    p.gap = (p.isLeader ? cents(p.points) - second : top - cents(p.points)) / 100;
  }
  // You first, then everyone else in the order they joined.
  people.sort((a, b) => Number(b.isMe) - Number(a.isMe));
  const week = currentStart ? rowsOf(currentStart)[0] : undefined;
  return {
    week: week ? { start: week.week_start, label: weekLabel(week.week_start), startsAt: week.starts_at, endsAt: week.ends_at } : null,
    people, leader, tied: top > 0 && atTop.length > 1,
    lastWeek: history[0] ?? null, history,
  };
}
