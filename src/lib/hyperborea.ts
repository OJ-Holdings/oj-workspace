import type { FinanceEntry, MercurySnapshot } from './dashboard';

/**
 * HYPERBOREA: the founders' expedition map. A private, founders-only view of OJ Holdings'
 * twenty-year climb from October 2026 to $100M a year and ten owned companies.
 *
 * Everything here is a pure function of recorded figures. Altitude is trailing-twelve-month
 * recorded revenue on a log scale; oxygen is the Mercury cash balance against recorded costs.
 * Nothing is estimated: missing revenue is "no records yet", missing costs are not zero.
 */

export const EXPEDITION_START = '2026-10-27';
export const SUMMIT_DEADLINE = '2046-10-27';
export const SUMMIT_REVENUE = 100_000_000;
export const SUMMIT_COMPANIES = 10;
export const SUMMIT_ALTITUDE = 8849;
/** Below this, the ghost's pace line starts from here so the required growth stays finite. */
export const GHOST_FLOOR = 10_000;

export type Camp = {
  id: 'base' | 'camp1' | 'camp2' | 'camp3' | 'camp4' | 'deathzone' | 'summit';
  name: string; altitude: number; revenue: number; era: string; gates: string[];
};

/** The route. Revenue is annual (trailing twelve months). Gates are founder-confirmed objectives, not computed. */
export const camps: readonly Camp[] = [
  { id: 'base', name: 'Base Camp', altitude: 0, revenue: 0, era: 'The hustle. The two of you do everything.',
    gates: ['Every business has its revenue recorded in the workspace', 'The Summit chapter written and sealed'] },
  { id: 'camp1', name: 'Camp I: The Treeline', altitude: 2500, revenue: 250_000, era: 'Crews run jobs without you on site.',
    gates: ['SOPs written for every service', 'One crew lead running jobs independently'] },
  { id: 'camp2', name: 'Camp II: Seven Figures', altitude: 4000, revenue: 1_000_000, era: 'A managed operation, not a side business.',
    gates: ['Two of three companies profitable', 'First salaried manager hired', 'Books clean and reviewed by a CPA'] },
  { id: 'camp3', name: 'Camp III: The Icewall', altitude: 5500, revenue: 5_000_000, era: 'You stop operating and start commanding.',
    gates: ['A general manager over each division', 'Both founders under 20 hours a week in operations'] },
  { id: 'camp4', name: 'Camp IV: South Col', altitude: 6500, revenue: 10_000_000, era: 'OJ starts buying companies, not just building them.',
    gates: ['First acquisition closed', 'A holdings-level CFO, fractional or full time'] },
  { id: 'deathzone', name: 'The Death Zone', altitude: 8000, revenue: 25_000_000, era: 'Most founders die here. The rope between you is tested.',
    gates: ['Operating agreement stress-tested: buy-sell, succession, deadlock'] },
  { id: 'summit', name: 'Summit', altitude: SUMMIT_ALTITUDE, revenue: SUMMIT_REVENUE, era: 'Endgame. $100M a year and ten companies owned.',
    gates: ['$100M recorded revenue in twelve months', 'Ten operating companies owned'] },
];

/** Altitude anchors: [annual revenue, metres]. Between anchors altitude moves linearly in log10(revenue). */
const anchors: readonly [number, number][] = [[1_000, 0], ...camps.slice(1).map(c => [c.revenue, c.altitude] as [number, number])];

export function altitudeFor(revenue: number): number {
  if (!Number.isFinite(revenue) || revenue <= anchors[0][0]) return 0;
  const last = anchors[anchors.length - 1];
  if (revenue >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [r1, a1] = anchors[i];
    if (revenue <= r1) {
      const [r0, a0] = anchors[i - 1];
      const t = (Math.log10(revenue) - Math.log10(r0)) / (Math.log10(r1) - Math.log10(r0));
      return Math.round(a0 + t * (a1 - a0));
    }
  }
  return last[1];
}

// ---- dates (ISO YYYY-MM-DD strings, compared as text) ----
const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(d + 'T00:00:00Z');
export function addDays(date: string, days: number): string { return new Date(toTime(date) + days * DAY).toISOString().slice(0, 10); }
export function daysBetween(from: string, to: string): number { return Math.round((toTime(to) - toTime(from)) / DAY); }

const revenueIn = (finance: readonly FinanceEntry[], after: string, through: string) =>
  finance.filter(f => f.kind === 'revenue' && f.occurred_on.slice(0, 10) > after && f.occurred_on.slice(0, 10) <= through).reduce((s, f) => s + f.amount, 0);
const costIn = (finance: readonly FinanceEntry[], after: string, through: string) =>
  finance.filter(f => f.kind === 'cost' && f.occurred_on.slice(0, 10) > after && f.occurred_on.slice(0, 10) <= through);

/** Recorded revenue in the 365 days ending on `asOf` (inclusive). */
export function trailingRevenue(finance: readonly FinanceEntry[], asOf: string): number {
  return revenueIn(finance, addDays(asOf, -365), asOf);
}

export type Weather = 'clear' | 'wind' | 'storm' | 'unknown';
/** Momentum: recorded revenue in the last 90 days against the 90 days before. */
export function weatherFor(finance: readonly FinanceEntry[], today: string): { weather: Weather; change: number | null; recent: number; prior: number } {
  const recent = revenueIn(finance, addDays(today, -90), today);
  const prior = revenueIn(finance, addDays(today, -180), addDays(today, -90));
  if (recent === 0 && prior === 0) return { weather: 'unknown', change: null, recent, prior };
  if (prior === 0) return { weather: 'clear', change: null, recent, prior };
  const change = (recent - prior) / prior;
  return { weather: change > 0.1 ? 'clear' : change >= -0.1 ? 'wind' : 'storm', change, recent, prior };
}

export type Clock = { day: number; totalDays: number; daysLeft: number; yearsLeft: number; progress: number };
export function expeditionClock(today: string): Clock {
  const totalDays = daysBetween(EXPEDITION_START, SUMMIT_DEADLINE);
  const elapsed = Math.min(Math.max(daysBetween(EXPEDITION_START, today), 0), totalDays);
  return { day: elapsed + 1, totalDays, daysLeft: totalDays - elapsed, yearsLeft: Math.round(((totalDays - elapsed) / 365.25) * 10) / 10, progress: elapsed / totalDays };
}

export type Ghost = { start: number; revenue: number; altitude: number; requiredGrowth: number; ahead: boolean | null; gap: number };
/**
 * The ghost climber walks the steady compounding line from the recorded revenue at the expedition's
 * start (floored at GHOST_FLOOR) to the summit on the deadline.
 */
export function ghostFor(finance: readonly FinanceEntry[], today: string, current: number, hasRecords: boolean): Ghost {
  const start = Math.max(trailingRevenue(finance, EXPEDITION_START), GHOST_FLOOR);
  const years = daysBetween(EXPEDITION_START, SUMMIT_DEADLINE) / 365.25;
  const { progress } = expeditionClock(today);
  const revenue = start * Math.pow(SUMMIT_REVENUE / start, progress);
  const altitude = altitudeFor(revenue);
  const mine = altitudeFor(current);
  return { start, revenue, altitude, requiredGrowth: Math.pow(SUMMIT_REVENUE / start, 1 / years) - 1, ahead: hasRecords ? mine >= altitude : null, gap: mine - altitude };
}

export type Oxygen =
  | { state: 'not-connected' | 'unavailable'; detail: string }
  | { state: 'known'; cash: number; burn: number | null; months: number | null; level: number | null; detail: string };
/**
 * Oxygen: cash in Mercury against average recorded monthly costs over the last 90 days.
 * With no costs recorded the runway is unknown, never infinite.
 */
export function oxygenFor(mercury: MercurySnapshot | undefined, finance: readonly FinanceEntry[], today: string): Oxygen {
  if (!mercury || mercury.state === 'not-connected') return { state: 'not-connected', detail: 'Connect the Mercury bank account to read the oxygen tank.' };
  const balances = mercury.accounts.map(a => a.availableBalance ?? a.currentBalance).filter((n): n is number => typeof n === 'number');
  if (mercury.state === 'unavailable' || balances.length === 0) return { state: 'unavailable', detail: mercury.detail || 'The bank balance could not be read.' };
  const cash = balances.reduce((s, n) => s + n, 0);
  const costs = costIn(finance, addDays(today, -90), today);
  if (costs.length === 0) return { state: 'known', cash, burn: null, months: null, level: null, detail: 'Runway unknown: no costs recorded in the last 90 days.' };
  const burn = costs.reduce((s, f) => s + f.amount, 0) / 3;
  if (burn <= 0) return { state: 'known', cash, burn: null, months: null, level: null, detail: 'Runway unknown: recorded costs net to zero.' };
  const months = cash / burn;
  return { state: 'known', cash, burn, months, level: Math.max(0, Math.min(months / 12, 1)), detail: months < 3 ? 'Low oxygen. Under three months of recorded costs in the bank.' : 'Months of recorded costs covered by cash in the bank.' };
}

/** Highest camp reached and the next one up. */
export function campFor(altitude: number): { current: Camp; next: Camp | null } {
  let index = 0;
  camps.forEach((c, i) => { if (altitude >= c.altitude) index = i; });
  return { current: camps[index], next: camps[index + 1] ?? null };
}

export type Achievement = { id: string; name: string; detail: string; earned: boolean | null; on?: string };
const monthTotals = (finance: readonly FinanceEntry[]) => {
  const map = new Map<string, number>();
  for (const f of finance) if (f.kind === 'revenue') map.set(f.occurred_on.slice(0, 7), (map.get(f.occurred_on.slice(0, 7)) ?? 0) + f.amount);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
};
/**
 * Badges. Revenue badges are computed from recorded figures; the rest are founder-confirmed
 * (earned: null) until the staged database step gives the founders somewhere to record them.
 */
export function achievementsFor(finance: readonly FinanceEntry[], today: string, coreVentures: readonly string[]): Achievement[] {
  const months = monthTotals(finance);
  const firstMonth = (min: number) => months.find(([, total]) => total >= min)?.[0];
  const blood = firstMonth(10_000), iron = firstMonth(50_000);
  const ttm = trailingRevenue(finance, today);
  const since = addDays(today, -90);
  const hydra = coreVentures.length > 0 && coreVentures.every(v => finance.some(f => f.kind === 'revenue' && f.venture === v && f.occurred_on.slice(0, 10) > since && f.occurred_on.slice(0, 10) <= today));
  return [
    { id: 'first-blood', name: 'First Blood', detail: 'A $10K month', earned: Boolean(blood), on: blood },
    { id: 'iron-month', name: 'Iron Month', detail: 'A $50K month', earned: Boolean(iron), on: iron },
    { id: 'hydra', name: 'Hydra', detail: 'Every business with recorded revenue in the last 90 days', earned: hydra },
    { id: 'seven-figures', name: 'Seven Figures', detail: '$1M recorded in twelve months', earned: ttm >= 1_000_000 },
    { id: 'legion', name: 'Legion', detail: '10 employees', earned: null },
    { id: 'conqueror', name: 'Conqueror', detail: 'First acquisition closed', earned: null },
    { id: 'fortress', name: 'Fortress', detail: 'OJ owns its own commercial real estate', earned: null },
    { id: 'iron-ledger', name: 'Iron Ledger', detail: '12 straight months of profit across every entity', earned: null },
    { id: 'centurion', name: 'Centurion', detail: '100 employees', earned: null },
  ];
}

export type Expedition = {
  today: string; hasRecords: boolean; revenue: number; altitude: number;
  camp: ReturnType<typeof campFor>; toNext: number | null;
  clock: Clock; ghost: Ghost; weather: ReturnType<typeof weatherFor>; oxygen: Oxygen;
  companies: number; summitReached: boolean; achievements: Achievement[];
};

export function expedition(input: { finance: readonly FinanceEntry[]; mercury?: MercurySnapshot; today: string; companies: number; coreVentures: readonly string[] }): Expedition {
  const { finance, mercury, today, companies, coreVentures } = input;
  const hasRecords = finance.some(f => f.kind === 'revenue');
  const revenue = trailingRevenue(finance, today);
  const altitude = altitudeFor(revenue);
  const camp = campFor(altitude);
  return {
    today, hasRecords, revenue, altitude, camp,
    toNext: camp.next ? Math.max(camp.next.revenue - revenue, 0) : null,
    clock: expeditionClock(today),
    ghost: ghostFor(finance, today, revenue, hasRecords),
    weather: weatherFor(finance, today),
    oxygen: oxygenFor(mercury, finance, today),
    companies,
    summitReached: revenue >= SUMMIT_REVENUE && companies >= SUMMIT_COMPANIES,
    achievements: achievementsFor(finance, today, coreVentures),
  };
}
