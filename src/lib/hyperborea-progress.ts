import type { FinanceEntry } from './dashboard';
import { addDays, altitudeFor, camps, daysBetween, SUMMIT_ALTITUDE, trailingRevenue } from './hyperborea';
import { milestones, totals } from './hyperborea-journal';

export const periods = ['24h', '7D', '30D', '90D', 'YTD', 'All'] as const;
export type Period = typeof periods[number];
export type InspectPoint = { id: string; altitude: number; label: string };
const date = (f: FinanceEntry) => f.occurred_on.slice(0, 10);
const recorded = (finance: readonly FinanceEntry[], today: string) => finance.filter(f => date(f) <= today);

export function periodStart(finance: readonly FinanceEntry[], today: string, period: Period) {
  if (period === 'All') {
    const first = recorded(finance, today).filter(f => f.kind === 'revenue').map(date).sort()[0];
    return first ? addDays(first, -1) : today;
  }
  if (period === 'YTD') return addDays(today.slice(0, 4) + '-01-01', -1);
  return addDays(today, -({ '24h': 1, '7D': 7, '30D': 30, '90D': 90 }[period]));
}

/** Reconstructed from today's records, never represented as an immutable historical snapshot. */
export function periodProgress(finance: readonly FinanceEntry[], today: string, period: Period) {
  const from = periodStart(finance, today, period);
  const startRevenue = trailingRevenue(finance, from), endRevenue = trailingRevenue(finance, today);
  const start = altitudeFor(startRevenue), end = altitudeFor(endRevenue);
  const entered = finance.filter(f => f.kind === 'revenue' && date(f) > from && date(f) <= today && date(f) > addDays(today, -365));
  const expired = finance.filter(f => f.kind === 'revenue' && date(f) > addDays(from, -365) && date(f) <= from && date(f) <= addDays(today, -365));
  const days = daysBetween(from, today);
  const step = Math.max(1, Math.ceil(days / 180));
  const points = [];
  for (let n = 0; n < days; n += step) {
    const on = addDays(from, n), revenue = trailingRevenue(finance, on);
    points.push({ on, revenue, altitude: altitudeFor(revenue) });
  }
  points.push({ on: today, revenue: endRevenue, altitude: end });
  return { from, through: today, start, end, delta: end - start,
    percent: start > 0 ? (end - start) / start * 100 : null,
    revenueDelta: endRevenue - startRevenue, entered, expired, points };
}

/** Exact inverse of the log-linear altitude scale (rounding only happens in the UI). */
export function revenueForAltitude(altitude: number) {
  if (!Number.isFinite(altitude)) throw new Error('A finite altitude is required');
  if (altitude <= 0) return 0;
  const anchors = [{ revenue: 1_000, altitude: 0 }, ...camps.slice(1)];
  for (let i = 1; i < anchors.length; i++) {
    if (altitude <= anchors[i].altitude) {
      const a = anchors[i - 1], b = anchors[i];
      return a.revenue * Math.pow(b.revenue / a.revenue, (altitude - a.altitude) / (b.altitude - a.altitude));
    }
  }
  return anchors.at(-1)!.revenue;
}

export function climbRequirement(finance: readonly FinanceEntry[], today: string, gain: number) {
  const revenue = trailingRevenue(finance, today), altitude = altitudeFor(revenue);
  const target = Math.min(SUMMIT_ALTITUDE, altitude + Math.max(0, gain));
  const required = target <= altitude ? revenue : revenueForAltitude(target);
  const expires30 = finance.filter(f => f.kind === 'revenue' && date(f) > addDays(today, -365) && date(f) <= addDays(today, -335)).reduce((s, f) => s + f.amount, 0);
  return { target, revenue: required, gap: Math.max(0, required - revenue), monthly: required / 12, expires30 };
}

export type TrailAchievement = { id: string; title: string; category: 'Revenue' | 'Customers' | 'Operations' | 'Company';
  requirement: string; value: number | null; target: number; on?: string; earned: boolean | null; evidence: string };

/** No legal-company, customer, employee or profit claims inferred from tabs or incomplete costs. */
export function trailAchievements(finance: readonly FinanceEntry[], today: string, names: Record<string, string>): TrailAchievement[] {
  const rows = recorded(finance, today).filter(f => f.kind === 'revenue');
  const total = totals(rows, today), log = milestones(rows, today, names);
  const out: TrailAchievement[] = [];
  for (const target of [1, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]) {
    let running = 0; const hit = [...rows].sort((a, b) => date(a).localeCompare(date(b))).find(f => (running += f.amount) >= target);
    out.push({ id: `total-${target}`, title: target === 1 ? 'First recorded dollar' : `$${target.toLocaleString('en-US')} recorded`, category: 'Revenue', requirement: 'Lifetime recorded revenue', value: total.lifetimeRevenue, target, earned: Boolean(hit), on: hit && date(hit), evidence: 'Recorded income entries; not independent bank settlement verification.' });
  }
  for (const target of [1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000]) {
    const months = new Map<string, number>(); let on: string | undefined;
    for (const f of [...rows].sort((a,b) => date(a).localeCompare(date(b)))) {
      const month = date(f).slice(0,7), amount = (months.get(month) ?? 0) + f.amount; months.set(month, amount);
      if (!on && amount >= target) on = date(f);
    }
    out.push({ id: `month-${target}`, title: `$${target.toLocaleString('en-US')} month`, category: 'Revenue', requirement: 'Revenue recorded in one calendar month', value: total.bestMonth?.amount ?? 0, target, earned: Boolean(on), on, evidence: 'Calendar-month income entries, reconstructed from current records.' });
  }
  for (const camp of camps.slice(1)) {
    const hit = log.find(m => m.title === `${camp.name} reached`);
    out.push({ id: camp.id, title: camp.name, category: 'Revenue', requirement: `$${camp.revenue.toLocaleString('en-US')} in a rolling 365-day window`, value: trailingRevenue(rows,today), target: camp.revenue, earned: Boolean(hit), on: hit?.on, evidence: 'First recorded threshold crossing. Current altitude may subsequently fall.' });
  }
  for (const [id, name] of Object.entries(names)) {
    const first = rows.filter(f => f.venture === id && f.amount > 0).sort((a,b) => date(a).localeCompare(date(b)))[0];
    out.push({ id:`venture-${id}`, title:`${name}: first income`, category:'Revenue', requirement:'First positive recorded income for this business', value:first ? 1 : 0, target:1, earned:Boolean(first), on:first && date(first), evidence:'Business-segment income entry, not proof of a separate legal entity.' });
  }
  const manual: [string, TrailAchievement['category'], string][] = [
    ['First repeat customer','Customers','Two completed, paid jobs tied to the same verified customer'],
    ['Ten paying customers','Customers','Ten distinct customers with payment evidence'],
    ['First referral customer','Customers','A paid job with recorded referral attribution'],
    ['First recurring agreement','Customers','An active customer agreement and its first collected payment'],
    ['Five customer reviews','Customers','Five attributable published customer reviews'],
    ['Service playbook','Operations','Current procedures and quality checks for every offered service'],
    ['Independent crew lead','Operations','A crew lead completes and verifies a job without a founder on site'],
    ['First salaried manager','Operations','Employment and actual payroll evidence'],
    ['Ten employees','Operations','Ten current employees verified from an authorized workforce record'],
    ['Founder freedom','Operations','Both founders under 20 operational hours per week over an agreed review period'],
    ['Clean books','Company','CPA-reviewed books with all known costs reconciled'],
    ['Three-month reserve','Company','Verified available cash covers three months of complete operating costs'],
    ['Twelve profitable months','Company','Twelve consecutive months of reconciled profit across all entities'],
    ['First acquisition','Company','Executed acquisition and ownership evidence'],
    ['Commercial property','Company','Verified company ownership of commercial property'],
    ['Ten owned companies','Company','Ten independently verified operating-company ownership records'],
  ];
  manual.forEach(([title, category, requirement], i) => out.push({ id:`evidence-${i}`, title, category, requirement, value:null, target:1, earned:null, evidence:'Evidence not connected. Review linked operational records; no completion is inferred.' }));
  return out;
}
