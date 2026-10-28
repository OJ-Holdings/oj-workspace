import type { ExteriorData } from './exterior';
import { rebookCandidates } from './exterior-rebook';
import { pipeline } from './growth-queues';
import type { TruckFund } from './truck-fund';

export type Season = 'in-season' | 'off-season';

/** The Exterior season in Kenosha: April through October is in season, November through March is off-season (master plan 11b). */
export const seasonFor = (today: string): Season => { const m = Number(today.slice(5, 7)); return m >= 4 && m <= 10 ? 'in-season' : 'off-season'; };

/** What a quarter of past customers rebooking would be worth: the one assumption in the winter plan, shown to the person as such. */
export const REBOOK_SHARE = 0.25;

/**
 * The winter plan: the three things that make the off-season count, each as numbers from the records. Past customers worth a spring rebooking
 * call and what a quarter of them would be worth at the average recorded job; where the truck fund stands against its date; and the quotes
 * still open. The average job is null until a finished job has a revenue figure, and then no value is quoted.
 */
export function winterPlan(data: ExteriorData, nowMs: number, fund: TruckFund) {
  const customers = rebookCandidates(data.leads, new Date(nowMs), 3).length;
  const revenues = data.leads.filter(l => l.status === 'completed' && l.job_revenue !== null).map(l => l.job_revenue as number);
  const avgJob = revenues.length ? revenues.reduce((t, r) => t + r, 0) / revenues.length : null;
  const p = pipeline(data.leads);
  return {
    rebook: { customers, avgJob, ifQuarterRebook: avgJob === null ? null : Math.round(customers * REBOOK_SHARE * avgJob) },
    truck: { known: fund.known, balance: fund.balance, goal: fund.goal, perWeekNeeded: fund.perWeekNeeded, daysLeft: fund.daysLeft, onTrack: fund.onTrack },
    openQuotes: { count: p.contacted.count + p.following_up.count, value: p.contacted.quoted + p.following_up.quoted },
  };
}
