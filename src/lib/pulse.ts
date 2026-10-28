/**
 * Pulse: everything the founders (and the email engine) did, as one feed of plain sentences, plus the game on top of it:
 * points for each thing done, a level, a daily streak and today's head-to-head. Every event comes from a real record; nothing is invented.
 */

export type PulseKind =
  | 'task-done' | 'task-new' | 'task-edit' | 'comment' | 'lead' | 'lead-edit' | 'job-done' | 'booking' | 'booking-change' | 'invoice' | 'payment' | 'bank'
  | 'expense' | 'photo' | 'proposal' | 'proposal-won' | 'proposal-lost' | 'customer' | 'number' | 'doc' | 'event' | 'dm' | 'email' | 'reply' | 'work' | 'system';

export type PulseEvent = {
  id: string; at: string; who: string; kind: PulseKind; text: string; xp: number;
  venture: 'exterior' | 'solutions' | 'essentials' | null; href?: string;
  /** Events with the same group key, person and kind close together are shown as one line ("posted 12 bank transactions"). {n} is replaced by the count. */
  group?: string; many?: string; count?: number;
};

/** Recent customer-relevant entries for the compact bell; never fabricate urgency or payment status. */
export function notificationEvents(events: PulseEvent[], limit = 8): PulseEvent[] {
  const kinds = new Set<PulseKind>(['lead', 'customer', 'reply', 'proposal-won', 'proposal-lost', 'booking', 'payment']);
  return events.filter(event => kinds.has(event.kind)).slice(0, Math.max(0, Math.min(20, limit)));
}

export const ENGINE = 'Email engine';

/** Points for each kind of work. Money and closed deals score most; small edits score a little so nothing is invisible. */
export const XP: Record<PulseKind, number> = {
  'task-done': 50, 'task-new': 10, 'task-edit': 2, comment: 5, lead: 20, 'lead-edit': 5, 'job-done': 80, booking: 40, 'booking-change': 5, invoice: 40, payment: 75,
  bank: 3, expense: 10, photo: 8, proposal: 60, 'proposal-won': 150, 'proposal-lost': 10, customer: 10, number: 5, doc: 10, event: 10, dm: 8, email: 0, reply: 0, work: 0, system: 0,
};
/** Timed work scores 10 points per full half hour. */
export const workXp = (minutes: number) => Math.floor(Math.max(0, minutes) / 30) * 10;

const BURST_MS = 45 * 60_000;

/** Folds runs of the same small thing (bank posts, task tweaks, emails) by one person into one line, newest first, even when someone else's work lands in between. */
export function mergeBursts(events: PulseEvent[]): PulseEvent[] {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  const out: Array<PulseEvent & { oldest: string }> = [];
  const open = new Map<string, PulseEvent & { oldest: string }>();
  for (const e of sorted) {
    const key = e.group ? `${e.who}|${e.kind}|${e.group}` : '';
    const burst = key ? open.get(key) : undefined;
    if (burst && chicagoDay(burst.oldest) === chicagoDay(e.at) && Date.parse(burst.oldest) - Date.parse(e.at) <= BURST_MS) {
      const n = (burst.count ?? 1) + 1;
      Object.assign(burst, { count: n, xp: burst.xp + e.xp, text: burst.many ? burst.many.replace('{n}', String(n)) : burst.text, oldest: e.at });
      continue;
    }
    const row = { ...e, oldest: e.at };
    out.push(row);
    if (key) open.set(key, row);
  }
  return out.map(({ oldest: _oldest, ...rest }) => { void _oldest; return rest; });
}

export const chicagoDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const dayShift = (day: string, by: number) => new Date(Date.parse(`${day}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

export const LEVEL_TITLES = ['Rookie', 'Grinder', 'Hustler', 'Operator', 'Closer', 'Boss', 'Tycoon', 'Legend'] as const;
/** Level n needs 100 x n x (n + 1) / 2 points: 100 for level 2, 300 for 3, 600 for 4, and so on. */
export function level(xp: number) {
  let n = 1;
  while (100 * n * (n + 1) / 2 <= xp) n++;
  const floor = 100 * (n - 1) * n / 2, next = 100 * n * (n + 1) / 2;
  return { level: n, title: LEVEL_TITLES[Math.min(n - 1, LEVEL_TITLES.length - 1)], into: xp - floor, span: next - floor, toNext: next - xp };
}

/** Days in a row, ending today (or yesterday, so a streak is not lost before today's first move), with at least one scored thing done. */
export function streak(days: Set<string>, today: string) {
  let d = days.has(today) ? today : dayShift(today, -1);
  let n = 0;
  while (days.has(d)) { n++; d = dayShift(d, -1); }
  return n;
}

export type Player = { name: string; xp: number; today: number; week: number; streak: number; lvl: ReturnType<typeof level>; best: PulseEvent | null; things: number };

/** The scoreboard for each founder from the loaded window. The engine and system lines never score. */
export function scoreboard(events: PulseEvent[], people: string[], nowIso: string): Player[] {
  const today = chicagoDay(nowIso);
  const weekAgo = dayShift(today, -6);
  return people.map(name => {
    const mine = events.filter(e => e.who === name && e.xp > 0);
    const days = new Set(mine.map(e => chicagoDay(e.at)));
    const xp = mine.reduce((s, e) => s + e.xp, 0);
    const todays = mine.filter(e => chicagoDay(e.at) === today);
    return {
      name, xp, today: todays.reduce((s, e) => s + e.xp, 0), week: mine.filter(e => chicagoDay(e.at) >= weekAgo).reduce((s, e) => s + e.xp, 0),
      streak: streak(days, today), lvl: level(xp), best: [...todays].sort((a, b) => b.xp - a.xp)[0] ?? null, things: todays.reduce((s, e) => s + (e.count ?? 1), 0),
    };
  });
}

/** Today / Yesterday / weekday name / date, for grouping the feed. */
export function dayLabel(iso: string, nowIso: string) {
  const d = chicagoDay(iso), today = chicagoDay(nowIso);
  if (d === today) return 'Today';
  if (d === dayShift(today, -1)) return 'Yesterday';
  const date = new Date(`${d}T12:00:00Z`);
  return d >= dayShift(today, -6) ? date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function ago(iso: string, nowIso: string) {
  const s = Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

const FIELD_WORDS: Record<string, string> = {
  job_revenue: 'revenue', job_cost: 'cost', quote_amount: 'quote', service_requested: 'service', notes: 'notes', name: 'name', phone: 'phone', address: 'address', status: 'status', source: 'lead source',
};
const shortDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The Exterior Care log already describes each change; this turns its wording into plain words ("job_revenue" becomes "revenue",
 * "2026-11-11 10:30-12" becomes "Wed, Nov 11 at 10:30") and picks the kind.
 */
export function plainLog(action: string, description: string, leadName: string | null): { kind: PulseKind; text: string } {
  const d = (description ?? '').trim();
  const who = leadName || 'a customer';
  const when = (s: string) => s.replace(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}(?::\d{2})?)(?:-\d{1,2}(?::\d{2})?)?/, (_m, ymd: string, t: string) => `${shortDate(ymd)} at ${t.includes(':') ? t : `${t}:00`}`);
  switch (action) {
    case 'lead_created': return { kind: 'lead', text: `added a new lead: ${d.replace(/^Added new (lead|commercial job):\s*/i, '').replace(' - ', ', ')}` };
    case 'status_changed': {
      const m = d.match(/^Marked (.+) as (.+)$/i);
      if (m && /completed/i.test(m[2])) return { kind: 'job-done', text: `finished the job for ${m[1]}` };
      return { kind: 'lead-edit', text: m ? `moved ${m[1]} to ${m[2].replace(/_/g, ' ')}` : d };
    }
    case 'lead_updated': {
      const m = d.match(/^Updated ([^:]+):\s*(.+)$/);
      if (m) return { kind: 'lead-edit', text: `updated ${m[1]}'s ${m[2].split(/,\s*/).map(f => FIELD_WORDS[f] ?? f.replace(/_/g, ' ')).join(', ')}` };
      if (/^Imported Local Services Ads leads/i.test(d)) return { kind: 'lead', text: d.replace(/^Imported/, 'imported') };
      if (/^Set lead source/i.test(d)) return { kind: 'lead-edit', text: d.replace(/^Set/, 'set') };
      return { kind: 'lead-edit', text: `updated ${who}` };
    }
    case 'booking_manual': return { kind: 'booking', text: `booked ${when(d.replace(/^Booked\s*/i, '').replace(' - ', ' for '))}` };
    case 'booking_updated': return { kind: 'booking-change', text: `moved ${when(d.replace(/^(Moved|Updated)( booking for)?\s*/i, '').replace(' - ', ' to '))}` };
    case 'booking_deleted': return { kind: 'booking-change', text: `cancelled ${when(d.replace(/^Deleted booking for\s*/i, '').replace(' - ', ' on '))}` };
    case 'dedup_run': return { kind: 'system', text: d.replace(/^Deduplication complete:\s*/i, 'cleaned up duplicates: ') };
    case 'sheet_synced': case 'doorknocking_synced': return { kind: 'system', text: 'synced the Exterior Care sheet' };
    default: return { kind: 'lead-edit', text: d ? d.charAt(0).toLowerCase() + d.slice(1) : `updated ${who}` };
  }
}

export const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const dollars = (n: number) => money(Math.round(n * 100));
