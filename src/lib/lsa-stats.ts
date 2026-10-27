import type { MetricEntry } from './dashboard';
import { jobDate, type ExtLead } from './exterior';

/** Google Local Services Ads numbers are logged by a founder each week as two hand-logged metrics, so both of them see the same figures. */
export const LSA_SPEND = 'LSA spend';
export const LSA_LEADS = 'LSA leads';

export type LsaMonth = {
  month: string;
  spend: number; leads: number; entries: number;
  costPerLead: number | null;
  /** Completed jobs this month whose lead source is tagged Local Services Ads, and the revenue recorded on them. */
  jobs: number; revenue: number; revenueJobs: number;
  costPerJob: number | null; returnOnSpend: number | null;
};

/** What LSA cost and what it produced in one month (YYYY-MM). Cost per job and return only appear when the inputs exist; nothing is guessed. */
export function lsaMonth(entries: MetricEntry[], leads: ExtLead[], month: string): LsaMonth {
  const inMonth = entries.filter(e => e.venture === 'exterior' && e.measured_on.startsWith(month) && Number.isFinite(e.value));
  const spend = inMonth.filter(e => e.label === LSA_SPEND).reduce((s, e) => s + e.value, 0);
  const leadCount = inMonth.filter(e => e.label === LSA_LEADS).reduce((s, e) => s + e.value, 0);
  const done = leads.filter(l => l.status === 'completed' && (l.source ?? '').trim().toLowerCase() === 'lsa' && jobDate(l).startsWith(month));
  const withRevenue = done.filter(l => typeof l.job_revenue === 'number' && Number.isFinite(l.job_revenue));
  const revenue = withRevenue.reduce((s, l) => s + (l.job_revenue as number), 0);
  return {
    month, spend, leads: leadCount, entries: inMonth.filter(e => e.label === LSA_SPEND || e.label === LSA_LEADS).length,
    costPerLead: leadCount > 0 && spend > 0 ? spend / leadCount : null,
    jobs: done.length, revenue, revenueJobs: withRevenue.length,
    costPerJob: done.length > 0 && spend > 0 ? spend / done.length : null,
    returnOnSpend: spend > 0 && withRevenue.length > 0 ? revenue / spend : null,
  };
}
