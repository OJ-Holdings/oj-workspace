import { workDay } from './task-workflows';
import { effectiveOutreachStatus, isExteriorNiche, safeOutreachUrl, type OutreachProspect } from './outreach';

/** The Daily 10: every DM is logged by the database, the day is Central time, and the score is worked out here. */
export const DEFAULT_DM_GOAL = 10;
export const XP_PER_DM = 10;
export const GOAL_BONUS_XP = 50;
/** Reminders stop pestering after this hour (Central). */
export const QUEST_CUTOFF_HOUR = 21;

export const dmChannels = ['instagram', 'facebook', 'linkedin', 'other'] as const;
export type DmChannel = typeof dmChannels[number];
export type DmLogEntry = { id: string; actor_id: string; prospect_id: string | null; channel: DmChannel; work_day: string; undone_at: string | null; created_at: string };
export type Partner = 'Oscar' | 'Jacob';

const live = (entries: DmLogEntry[]) => entries.filter(e => !e.undone_at);

/** Day arithmetic on YYYY-MM-DD strings, free of time zones. */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const weekday = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** Sunday is a rest day: it neither breaks a streak nor counts toward it. */
export const isRestDay = (day: string) => weekday(day) === 0;
export const weekStart = (day: string) => addDays(day, -((weekday(day) + 6) % 7));
export function centralHour(now: Date) {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' }).format(now);
  return Number(hour) % 24;
}

export function dayCount(entries: DmLogEntry[], actor: string, day: string) {
  return live(entries).filter(e => e.actor_id === actor && e.work_day === day).length;
}
export function countsByDay(entries: DmLogEntry[], actor: string) {
  const out = new Map<string, number>();
  for (const e of live(entries)) if (e.actor_id === actor) out.set(e.work_day, (out.get(e.work_day) ?? 0) + 1);
  return out;
}

export type Streak = { days: number; metToday: boolean; atRisk: boolean };
/** Consecutive goal days ending today (or yesterday while today is still open). */
export function streakFor(entries: DmLogEntry[], actor: string, goal: number, today: string): Streak {
  const counts = countsByDay(entries, actor);
  const metToday = (counts.get(today) ?? 0) >= goal;
  let day = metToday ? today : addDays(today, -1);
  let days = 0;
  for (let i = 0; i < 400; i++) {
    if (isRestDay(day)) { day = addDays(day, -1); continue; }
    if ((counts.get(day) ?? 0) < goal) break;
    days++; day = addDays(day, -1);
  }
  return { days, metToday, atRisk: !metToday && days > 0 };
}

/** Consecutive days on which every partner hit the goal. */
export function teamStreak(entries: DmLogEntry[], actors: string[], goal: number, today: string) {
  if (!actors.length) return 0;
  const per = actors.map(a => countsByDay(entries, a));
  const met = (day: string) => per.every(c => (c.get(day) ?? 0) >= goal);
  let day = met(today) ? today : addDays(today, -1);
  let days = 0;
  for (let i = 0; i < 400; i++) {
    if (isRestDay(day)) { day = addDays(day, -1); continue; }
    if (!met(day)) break;
    days++; day = addDays(day, -1);
  }
  return days;
}

export function xpFor(entries: DmLogEntry[], actor: string, goal: number) {
  const counts = countsByDay(entries, actor);
  let xp = 0;
  for (const n of counts.values()) xp += n * XP_PER_DM + (n >= goal ? GOAL_BONUS_XP : 0);
  return xp;
}

const titles = ['Rookie', 'Hustler', 'Closer', 'Operator', 'Rainmaker', 'Shark', 'Warlord', 'Legend', 'Titan', 'Mythic'];
/** Level L starts at 50 * L * (L - 1) XP: 0, 100, 300, 600, 1000, 1500, ... */
export function levelFor(xp: number) {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  const from = 50 * level * (level - 1), to = 50 * (level + 1) * level;
  return { level, title: titles[Math.min(level, titles.length) - 1], into: xp - from, span: to - from, pct: Math.round(((xp - from) / (to - from)) * 100) };
}

export type QuestTone = 'start' | 'go' | 'push' | 'urgent' | 'done' | 'closed';
export function questLine(done: number, goal: number, hour: number): { headline: string; sub: string; tone: QuestTone } {
  const left = Math.max(goal - done, 0);
  if (left === 0) return { headline: 'Quest clear', sub: done > goal ? `${done - goal} over the goal. Bonus XP banked.` : 'Goal hit. Everything past this is bonus XP.', tone: 'done' };
  if (hour >= QUEST_CUTOFF_HOUR) return { headline: `Day over: ${done} of ${goal}`, sub: 'The quest window has closed. Start fresh tomorrow.', tone: 'closed' };
  const hoursLeft = QUEST_CUTOFF_HOUR - hour;
  if (hour >= 18) return { headline: `${left} to go. Last stretch.`, sub: `${hoursLeft} ${hoursLeft === 1 ? 'hour' : 'hours'} left. Do not break the streak.`, tone: 'urgent' };
  if (hour >= 14 && done < goal / 2) return { headline: `${left} to go. You are behind.`, sub: `${hoursLeft} hours left. Ten minutes gets you moving.`, tone: 'push' };
  if (done === 0) return { headline: `${goal} DMs today`, sub: 'Open the first target and send it. The rest follow.', tone: 'start' };
  return { headline: `${left} to go`, sub: `${done} sent. Keep the pace.`, tone: 'go' };
}

const socialRoots = { instagram: 'https://instagram.com', facebook: 'https://facebook.com' } as const;
export function socialUrl(value: string | null, channel: keyof typeof socialRoots) {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return safeOutreachUrl(v);
  const handle = v.replace(/^@/, '').replace(/\/+$/, '');
  return /^[\w.\-]{1,100}$/.test(handle) ? `${socialRoots[channel]}/${encodeURIComponent(handle)}` : null;
}

export type DmTarget = {
  prospect: OutreachProspect; channel: 'instagram' | 'facebook'; url: string; exterior: boolean; mine: boolean;
};
export const dmTargetFields = 'id,organization_id,business_name,industry,city_state,website_url,decision_maker,best_fit_service,secondary_fit,leak,instagram,facebook,dm,date_added,sent_by,source_status,outreach_status,email,source_row' as const;

/** People worth a DM now: not contacted by DM, reachable on a social profile, own list first, exterior cleaning first. */
export function dmTargets(prospects: OutreachProspect[], me: Partner | null, dmedToday: ReadonlySet<string> = new Set()): DmTarget[] {
  const out: (DmTarget & { score: number })[] = [];
  for (const p of prospects) {
    const status = effectiveOutreachStatus(p);
    if ((status !== 'Not Sent' && status !== 'Emailed') || dmedToday.has(p.id)) continue;
    const ig = socialUrl(p.instagram, 'instagram'), fb = socialUrl(p.facebook, 'facebook');
    const channel = ig ? 'instagram' : fb ? 'facebook' : null;
    const url = ig ?? fb;
    if (!channel || !url) continue;
    const mine = me !== null && p.sent_by === me, exterior = isExteriorNiche(p);
    const score = (mine ? 4 : p.sent_by === null ? 2 : 0) + (exterior ? 3 : 0) + (p.dm ? 1 : 0) + (status === 'Not Sent' ? 1 : 0);
    out.push({ prospect: p, channel, url, exterior, mine, score });
  }
  return out.sort((a, b) => b.score - a.score || (a.prospect.date_added ?? '').localeCompare(b.prospect.date_added ?? '') || a.prospect.business_name.localeCompare(b.prospect.business_name))
    .map(({ score: _score, ...rest }) => rest);
}

export type DayBar = { day: string; count: number; goalMet: boolean; rest: boolean };
/** The seven days ending today, for the weekly strip. */
export function lastSevenDays(entries: DmLogEntry[], actor: string, goal: number, today: string): DayBar[] {
  const counts = countsByDay(entries, actor);
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(day => ({ day, count: counts.get(day) ?? 0, goalMet: (counts.get(day) ?? 0) >= goal, rest: isRestDay(day) }));
}
export function weekTotal(entries: DmLogEntry[], actor: string, today: string) {
  const start = weekStart(today);
  return live(entries).filter(e => e.actor_id === actor && e.work_day >= start && e.work_day <= today).length;
}

/** Name used for a partner: the first word of the membership's display name. */
export function partnerOf(displayName: string): Partner | null {
  const first = displayName.trim().split(/\s+/)[0]?.toLowerCase();
  return first === 'oscar' ? 'Oscar' : first === 'jacob' ? 'Jacob' : null;
}
export const todayKey = (now: Date) => workDay(now);

// ---- Reminders ---------------------------------------------------------------------------
/** Hours (Central) at which a partner who is under the goal gets nudged. */
export const REMINDER_SLOTS = [10, 14, 18, 20] as const;
export type QuestPerson = { name: Partner; done: number; streak: number; atRisk: boolean };
export type Reminder = { key: string; name: Partner; slot: number; subject: string; body: string };

/** The nudges due right now. Only the latest slot that has started is returned, and only for people under the goal. */
export function buildReminders(input: { people: QuestPerson[]; goal: number; hour: number; today: string; link: string }): Reminder[] {
  const slot = [...REMINDER_SLOTS].reverse().find(s => input.hour >= s);
  if (slot === undefined || input.hour >= QUEST_CUTOFF_HOUR || isRestDay(input.today)) return [];
  return input.people.filter(p => p.done < input.goal).map(p => {
    const left = input.goal - p.done;
    const other = input.people.find(o => o.name !== p.name);
    const subject = slot === 10 ? `Daily ${input.goal} is live: ${p.done}/${input.goal}`
      : slot === 14 ? `Halftime check: ${p.done}/${input.goal} DMs`
      : slot === 18 ? `${left} DM${left === 1 ? '' : 's'} to go${p.atRisk ? ': streak at risk' : ''}`
      : `Last call: ${left} DM${left === 1 ? '' : 's'} left tonight`;
    const lines = [
      `${p.name}, you are at ${p.done} of ${input.goal} DMs today. ${left} to go.`,
      p.atRisk ? `Your ${p.streak}-day streak ends tonight if you stop here.` : p.streak > 0 ? `You are on a ${p.streak}-day streak.` : '',
      other ? (other.done >= input.goal ? `${other.name} already cleared the quest.` : `${other.name} is at ${other.done} of ${input.goal}.`) : '',
      `Each one takes about a minute: ${input.link}`,
    ].filter(Boolean);
    return { key: `${input.today}:${slot}:${p.name}`, name: p.name, slot, subject, body: lines.join('\n\n') };
  });
}
