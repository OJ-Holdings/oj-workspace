import type { MetricEntry } from './dashboard';

/**
 * The truck and rig plan (master plan 6.17) is kept as hand-logged metric entries, like the truck fund balance, so both founders see the same plan and no
 * database change is needed. The newest entry for a label is the current one; changing a line logs a new entry and dropping one logs status "dropped".
 */
export const RIG_PREFIX = 'Rig: ';
export const DEAL_PREFIX = 'Truck deal: ';
export const WASHER_REPAIR = 'Washer repair quote';
export const WASHER_RENTAL_DAY = 'Washer rental per day';
export const WASHER_RENTAL_DAYS = 'Washer rental days so far';
export const WASHER_REPLACE = 'Washer replacement price';
export const RIG_STATUSES = ['researching', 'quoted', 'bought'] as const;
export type RigStatus = (typeof RIG_STATUSES)[number];
export const DROPPED = 'dropped';

/** The lines the plan expects in a work-truck rig. A price is entered when one is known; nothing is pre-filled. */
export const rigItems = [
  'Truck or van', 'Water tank and pump', 'Pressure washer (repair or replace)', 'Hose reels and skid mounting', 'Chemical storage and injection',
  'Water-fed pole system and extra poles', 'Ladder racks and ladders', 'Exhaust-safe install and CO alarm', 'Insurance and registration',
  'Lettering or wrap', 'Tools, fittings and spares kit', 'First-year maintenance reserve',
] as const;

const newest = (entries: MetricEntry[], test: (label: string) => boolean) => {
  const latest = new Map<string, MetricEntry>();
  for (const e of entries) {
    if (e.venture !== 'exterior' || !test(e.label) || !Number.isFinite(e.value) || !/^\d{4}-\d{2}-\d{2}/.test(e.measured_on)) continue;
    const cur = latest.get(e.label);
    // The list is newest first (the page puts a new entry at the front, the database sorts by day then creation time), so on the same day the first one seen is the newest.
    if (!cur || e.measured_on.slice(0, 10) > cur.measured_on.slice(0, 10)) latest.set(e.label, e);
  }
  return [...latest.values()];
};

export type RigLine = { item: string; price: number; status: RigStatus; note: string; asOf: string };

export function rigLines(entries: MetricEntry[]): RigLine[] {
  return newest(entries, l => l.startsWith(RIG_PREFIX)).filter(e => e.unit !== DROPPED).map(e => ({
    item: e.label.slice(RIG_PREFIX.length), price: e.value, status: (RIG_STATUSES as readonly string[]).includes(e.unit) ? (e.unit as RigStatus) : 'researching', note: e.note, asOf: e.measured_on.slice(0, 10),
  })).sort((a, b) => b.price - a.price || a.item.localeCompare(b.item));
}

export function rigTotals(lines: RigLine[]) {
  const sum = (s: RigStatus) => lines.filter(l => l.status === s).reduce((t, l) => t + l.price, 0);
  const total = lines.reduce((t, l) => t + l.price, 0);
  return { total, bought: sum('bought'), quoted: sum('quoted'), researching: sum('researching'), unpriced: lines.filter(l => l.price === 0).length };
}

/** Standard lines not on the list yet, so they can be added with one tap. */
export const missingItems = (lines: RigLine[]) => rigItems.filter(i => !lines.some(l => l.item.toLowerCase() === i.toLowerCase()));

/** The budget against the goal and against what the fund holds. A null balance means the fund is not known, so no gap is claimed. */
export function rigGap(goal: number, total: number, balance: number | null) {
  return { overGoal: total - goal, shortOfBudget: balance === null ? null : Math.max(0, total - balance), fundedPercent: balance === null || total <= 0 ? null : Math.min(100, (balance / total) * 100) };
}

export type Inspection = 'unknown' | 'passed' | 'failed';
export type Deal = { name: string; price: number; miles: number | null; year: number | null; url: string; notes: string; inspection: Inspection; rating: number | null };

export const encodeDeal = (d: Omit<Deal, 'name' | 'price'>) => JSON.stringify({ m: d.miles, y: d.year, u: d.url.slice(0, 200), n: d.notes.slice(0, 160), i: d.inspection, r: d.rating }).slice(0, 500);

export function dealList(entries: MetricEntry[]): Deal[] {
  return newest(entries, l => l.startsWith(DEAL_PREFIX)).filter(e => e.unit !== DROPPED).map(e => {
    let raw: Record<string, unknown> = {};
    try { const p = JSON.parse(e.note); if (p && typeof p === 'object') raw = p as Record<string, unknown>; } catch { /* a note that is not ours shows as no details */ }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const rating = num(raw.r);
    return {
      name: e.label.slice(DEAL_PREFIX.length), price: e.value, miles: num(raw.m), year: num(raw.y), url: typeof raw.u === 'string' ? raw.u : '', notes: typeof raw.n === 'string' ? raw.n : '',
      inspection: (raw.i === 'passed' || raw.i === 'failed' ? raw.i : 'unknown') as Inspection, rating: rating !== null && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    };
  }).sort((a, b) => Number(a.inspection === 'failed') - Number(b.inspection === 'failed') || (b.rating ?? 0) - (a.rating ?? 0) || a.price - b.price);
}

/** Only an https link is ever offered as a link. */
export const safeUrl = (u: string) => (/^https:\/\/[^\s]+$/i.test(u) ? u : null);

export type Washer = { repair: number | null; perDay: number | null; days: number | null; replace: number | null };
export function washerFigures(entries: MetricEntry[]): Washer {
  const by = new Map(newest(entries, l => [WASHER_REPAIR, WASHER_RENTAL_DAY, WASHER_RENTAL_DAYS, WASHER_REPLACE].includes(l)).map(e => [e.label, e.value]));
  return { repair: by.get(WASHER_REPAIR) ?? null, perDay: by.get(WASHER_RENTAL_DAY) ?? null, days: by.get(WASHER_RENTAL_DAYS) ?? null, replace: by.get(WASHER_REPLACE) ?? null };
}

/** What the renting has cost and how many more rental days the repair quote equals. Each figure appears only when its inputs were entered. */
export function washerVerdict(w: Washer) {
  const rentalSpent = w.perDay !== null && w.days !== null ? w.perDay * w.days : null;
  const breakEvenDays = w.repair !== null && w.perDay !== null && w.perDay > 0 ? Math.ceil(w.repair / w.perDay) : null;
  const cheaper = w.repair !== null && w.replace !== null ? (w.repair < w.replace ? 'repair' : w.repair > w.replace ? 'replace' : 'same') as 'repair' | 'replace' | 'same' : null;
  return { rentalSpent, breakEvenDays, cheaper, savedByReplacing: w.repair !== null && w.replace !== null ? w.repair - w.replace : null };
}
