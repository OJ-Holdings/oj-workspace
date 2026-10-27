import type { FinanceEntry } from './dashboard';
import { addDays, altitudeFor, camps, daysBetween, EXPEDITION_START, SUMMIT_DEADLINE, SUMMIT_REVENUE, trailingRevenue } from './hyperborea';

/**
 * The expedition journal: what has been done, why the altitude is what it is, and what comes next.
 * Pure functions of recorded finance entries. Everything is "recorded": quotes are not revenue,
 * and a business with no costs on record has an unknown margin, not a 100% one.
 */

const day = (f: FinanceEntry) => f.occurred_on.slice(0, 10);
const revenueOf = (finance: readonly FinanceEntry[]) => finance.filter(f => f.kind === 'revenue' && f.amount > 0);
const monthEnd = (month: string) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const nextMonth = (month: string) => { const [y, m] = month.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };

// ---------------------------------------------------------------- the climb so far

export type HistoryPoint = { month: string; through: string; revenue: number; altitude: number; monthRevenue: number };
/** Trailing-twelve-month revenue and altitude at the end of every month since the first recorded revenue. */
export function altitudeHistory(finance: readonly FinanceEntry[], today: string): HistoryPoint[] {
  const rev = revenueOf(finance).filter(f => day(f) <= today);
  if (!rev.length) return [];
  const first = rev.map(day).sort()[0].slice(0, 7), last = today.slice(0, 7);
  const out: HistoryPoint[] = [];
  for (let m = first; m <= last; m = nextMonth(m)) {
    const through = m === last ? today : monthEnd(m);
    const revenue = trailingRevenue(rev, through);
    const monthRevenue = rev.filter(f => day(f).startsWith(m)).reduce((s, f) => s + f.amount, 0);
    out.push({ month: m, through, revenue, altitude: altitudeFor(revenue), monthRevenue });
    if (out.length > 400) break;
  }
  return out;
}

export type Milestone = { on: string; title: string; detail: string; kind: 'first' | 'month' | 'lifetime' | 'camp' | 'record' };
const MONTH_MARKS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 1_000_000];
const LIFETIME_MARKS = [1_000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000];
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: n >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: n >= 100_000 ? 1 : 0 }).format(n);

/** Everything the record shows the founders have already done, oldest first. */
export function milestones(finance: readonly FinanceEntry[], today: string, names: Record<string, string>): Milestone[] {
  const rev = revenueOf(finance).filter(f => day(f) <= today).sort((a, b) => day(a).localeCompare(day(b)));
  if (!rev.length) return [];
  const out: Milestone[] = [];
  out.push({ on: day(rev[0]), title: 'First recorded revenue', detail: `${usd(rev[0].amount)} for ${names[rev[0].venture] ?? rev[0].venture}. The expedition leaves the plain.`, kind: 'first' });
  const seen = new Set<string>([rev[0].venture]);
  for (const f of rev) if (!seen.has(f.venture)) { seen.add(f.venture); out.push({ on: day(f), title: `${names[f.venture] ?? f.venture} earns`, detail: `First recorded revenue for ${names[f.venture] ?? f.venture}: ${usd(f.amount)}.`, kind: 'first' }); }

  // Lifetime totals crossed.
  let total = 0, li = 0;
  for (const f of rev) {
    total += f.amount;
    while (li < LIFETIME_MARKS.length && total >= LIFETIME_MARKS[li]) { out.push({ on: day(f), title: `${usd(LIFETIME_MARKS[li])} earned, all time`, detail: 'Total recorded revenue across every business.', kind: 'lifetime' }); li++; }
  }
  // Months that crossed a size for the first time, and each new best month.
  const months = new Map<string, number>();
  for (const f of rev) months.set(day(f).slice(0, 7), (months.get(day(f).slice(0, 7)) ?? 0) + f.amount);
  let mi = 0, best = 0;
  for (const [m, amount] of [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const crossed: number[] = [];
    while (mi < MONTH_MARKS.length && amount >= MONTH_MARKS[mi]) { crossed.push(MONTH_MARKS[mi]); mi++; }
    if (crossed.length) out.push({ on: monthEnd(m) > today ? today : monthEnd(m), title: `First ${usd(crossed[crossed.length - 1])} month`, detail: `${usd(amount)} recorded in ${monthLabel(m)}.`, kind: 'month' });
    else if (amount > best && best > 0) out.push({ on: monthEnd(m) > today ? today : monthEnd(m), title: 'New best month', detail: `${usd(amount)} in ${monthLabel(m)}, beating ${usd(best)}.`, kind: 'record' });
    best = Math.max(best, amount);
  }
  // Camps reached: the first day trailing revenue crossed each camp.
  for (const c of camps.slice(1)) {
    const hit = rev.find(f => trailingRevenue(rev, day(f)) >= c.revenue);
    if (hit) out.push({ on: day(hit), title: `${c.name} reached`, detail: `${usd(c.revenue)} recorded in twelve months. ${c.era}`, kind: 'camp' });
  }
  return out.sort((a, b) => a.on.localeCompare(b.on) || order(a.kind) - order(b.kind));
}
const order = (k: Milestone['kind']) => ({ first: 0, lifetime: 1, month: 2, record: 3, camp: 4 })[k];
export const monthLabel = (m: string) => new Date(m + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export type Totals = { lifetimeRevenue: number; lifetimeCosts: number | null; entries: number; firstOn: string | null; bestMonth: { month: string; amount: number } | null; daysClimbing: number };
export function totals(finance: readonly FinanceEntry[], today: string): Totals {
  const rev = revenueOf(finance).filter(f => day(f) <= today);
  const costs = finance.filter(f => f.kind === 'cost' && day(f) <= today);
  const months = new Map<string, number>();
  for (const f of rev) months.set(day(f).slice(0, 7), (months.get(day(f).slice(0, 7)) ?? 0) + f.amount);
  const bestEntry = [...months.entries()].sort((a, b) => b[1] - a[1])[0];
  const firstOn = rev.length ? rev.map(day).sort()[0] : null;
  return {
    lifetimeRevenue: rev.reduce((s, f) => s + f.amount, 0),
    lifetimeCosts: costs.length ? costs.reduce((s, f) => s + f.amount, 0) : null,
    entries: rev.length, firstOn,
    bestMonth: bestEntry ? { month: bestEntry[0], amount: bestEntry[1] } : null,
    daysClimbing: firstOn ? daysBetween(firstOn, today) + 1 : 0,
  };
}

// ---------------------------------------------------------------- why we are where we are

export type VentureShare = { venture: string; name: string; revenue: number; share: number; costs: number | null; margin: number | null; recent: number; prior: number; trend: number | null };
export type Breakdown = {
  ventures: VentureShare[];
  categories: { name: string; revenue: number; share: number }[];
  /** Annualised from the last 90 days of recorded revenue. */
  runRate: number; runRateAltitude: number;
  /** Ventures with nothing recorded in the last twelve months. */
  silent: string[];
};
export function breakdown(finance: readonly FinanceEntry[], today: string, ventureIds: readonly string[], names: Record<string, string>): Breakdown {
  const from = addDays(today, -365), in12 = (f: FinanceEntry) => day(f) > from && day(f) <= today;
  const rev = revenueOf(finance).filter(in12);
  const total = rev.reduce((s, f) => s + f.amount, 0);
  const r90 = addDays(today, -90), r180 = addDays(today, -180);
  const ventures = ventureIds.map(v => {
    const mine = rev.filter(f => f.venture === v);
    const revenue = mine.reduce((s, f) => s + f.amount, 0);
    const costRows = finance.filter(f => f.kind === 'cost' && f.venture === v && in12(f));
    const costs = costRows.length ? costRows.reduce((s, f) => s + f.amount, 0) : null;
    const recent = revenueOf(finance).filter(f => f.venture === v && day(f) > r90 && day(f) <= today).reduce((s, f) => s + f.amount, 0);
    const prior = revenueOf(finance).filter(f => f.venture === v && day(f) > r180 && day(f) <= r90).reduce((s, f) => s + f.amount, 0);
    return { venture: v, name: names[v] ?? v, revenue, share: total ? revenue / total : 0, costs, margin: costs === null || revenue === 0 ? null : (revenue - costs) / revenue, recent, prior, trend: prior > 0 ? (recent - prior) / prior : null };
  }).sort((a, b) => b.revenue - a.revenue);
  const cats = new Map<string, number>();
  for (const f of rev) { const k = (f.category || 'Uncategorised').trim(); cats.set(k, (cats.get(k) ?? 0) + f.amount); }
  const categories = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, revenue]) => ({ name, revenue, share: total ? revenue / total : 0 }));
  const last90 = revenueOf(finance).filter(f => day(f) > r90 && day(f) <= today).reduce((s, f) => s + f.amount, 0);
  const runRate = last90 * (365 / 90);
  return { ventures, categories, runRate, runRateAltitude: altitudeFor(runRate), silent: ventures.filter(v => v.revenue === 0).map(v => v.name) };
}

// ---------------------------------------------------------------- what comes next

/**
 * Days until trailing revenue first reaches `target` if every future day earns the average of the
 * last 90 days. Revenue already on the books still ages out of the window. Null if never (within 25 years).
 */
export function daysToReach(finance: readonly FinanceEntry[], today: string, target: number): number | null {
  const rev = revenueOf(finance).filter(f => day(f) <= today);
  const ttm = trailingRevenue(rev, today);
  if (ttm >= target) return 0;
  const perDay = rev.filter(f => day(f) > addDays(today, -90)).reduce((s, f) => s + f.amount, 0) / 90;
  if (perDay <= 0) return null;
  // Revenue leaving the window, by day offset.
  const leaving = new Map<number, number>();
  for (const f of rev) { const off = daysBetween(addDays(today, -365), day(f)); if (off > 0) leaving.set(off, (leaving.get(off) ?? 0) + f.amount); }
  let running = ttm;
  for (let d = 1; d <= 365 * 25; d++) {
    running += perDay - (leaving.get(d) ?? 0);
    if (running >= target) return d;
  }
  return null;
}

/** The date the steady 2046 pace line (from `start`) passes a given annual revenue. */
export function ghostDueDate(start: number, target: number): string {
  if (target <= start) return EXPEDITION_START;
  const total = daysBetween(EXPEDITION_START, SUMMIT_DEADLINE);
  const p = Math.log(target / start) / Math.log(SUMMIT_REVENUE / start);
  return addDays(EXPEDITION_START, Math.round(Math.min(p, 1) * total));
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5];
/** Round-number targets between here and the next camp: the next ridgelines to cross. */
export function waypointTargets(revenue: number, nextCamp: number | null, count = 3): number[] {
  if (nextCamp === null) return [];
  const out: number[] = [];
  for (let exp = 3; exp <= 8 && out.length < 40; exp++) for (const n of NICE) {
    const v = n * 10 ** exp;
    if (v > revenue * 1.15 && v < nextCamp) out.push(v);
  }
  // Thin to an even spread so each step is meaningful.
  const step = Math.max(1, Math.floor(out.length / count));
  const picked = out.filter((_, i) => i % step === step - 1 || out.length <= count).slice(0, count - 1);
  return [...picked, nextCamp];
}

export type Objective = {
  revenue: number; altitude: number; gap: number; isCamp: boolean; name: string;
  /** Recorded revenue needed per month, on average, to hold that annual figure. */
  monthly: number;
  etaDays: number | null; etaOn: string | null;
  dueOn: string; late: boolean;
};
export function objectives(finance: readonly FinanceEntry[], today: string, ghostStart: number): Objective[] {
  const revenue = trailingRevenue(revenueOf(finance), today);
  const next = camps.find(c => c.revenue > revenue) ?? null;
  return waypointTargets(revenue, next?.revenue ?? null).map(target => {
    const camp = camps.find(c => c.revenue === target);
    const etaDays = daysToReach(finance, today, target);
    const dueOn = ghostDueDate(ghostStart, target);
    return {
      revenue: target, altitude: altitudeFor(target), gap: Math.max(target - revenue, 0), isCamp: Boolean(camp),
      name: camp ? camp.name : `${usd(target)} a year`, monthly: target / 12,
      etaDays, etaOn: etaDays === null ? null : addDays(today, etaDays), dueOn,
      late: etaDays === null || addDays(today, etaDays) > dueOn,
    };
  });
}

/** Every camp's due date on the 2046 pace line. */
export function campSchedule(ghostStart: number) {
  return camps.slice(1).map(c => ({ id: c.id, name: c.name, revenue: c.revenue, dueOn: ghostDueDate(ghostStart, c.revenue) }));
}

/** Achievement progress for the revenue badges still locked. */
export function badgeProgress(finance: readonly FinanceEntry[], today: string) {
  const t = totals(finance, today);
  const best = t.bestMonth?.amount ?? 0;
  const ttm = trailingRevenue(revenueOf(finance), today);
  return [
    { id: 'first-blood', target: 10_000, value: best, label: 'Best month vs a $10K month' },
    { id: 'iron-month', target: 50_000, value: best, label: 'Best month vs a $50K month' },
    { id: 'seven-figures', target: 1_000_000, value: ttm, label: 'Last 12 months vs $1M' },
  ].map(b => ({ ...b, progress: Math.min(b.value / b.target, 1) }));
}
