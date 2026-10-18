import type { Dashboard, FinanceEntry } from './dashboard';
import type { Card } from './board';
import { ventureIds, type VentureId } from './ventures';
import { jobDate, jobDateBasis, jobFigures, type ExtLead } from './exterior';
import type { ShopOrder } from './shopify';

/** Operational reports use the business's calendar, independent of the viewer's timezone. */
export function businessDay(iso: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) : null;
}

export type JobFilters = { from: string; to: string; service: string; source: string };
export const emptyJobFilters: JobFilters = { from: '', to: '', service: '', source: '' };
export const serviceName = (lead: Pick<ExtLead, 'service_requested'>) => lead.service_requested?.trim() || 'Unspecified';

/** Every job-report tile, group and source table uses this same completed-work population. */
export function filterCompletedJobs(leads: ExtLead[], filters: JobFilters, sourceOf: (source: string | null) => string) {
  return leads.filter(lead => {
    if (lead.status !== 'completed') return false;
    const date = businessDay(jobDate(lead));
    if ((filters.from || filters.to) && (!date || (filters.from && date < filters.from) || (filters.to && date > filters.to))) return false;
    return (!filters.service || serviceName(lead) === filters.service) && (!filters.source || sourceOf(lead.source) === filters.source);
  });
}

export type ExternalJob = Pick<ExtLead, 'id' | 'status' | 'service_requested' | 'job_revenue' | 'job_cost' | 'completed_at' | 'updated_at' | 'created_at'>;

/** Legacy job payments have no independent collection date. Carry that limitation with every row. */
export function exteriorFinance(leads: ExternalJob[]) {
  const done = leads.filter(lead => lead.status === 'completed');
  const finance: FinanceEntry[] = [];
  for (const lead of done) {
    const occurred_on = businessDay(jobDate(lead));
    if (!occurred_on) continue;
    const common = { venture: 'exterior' as const, occurred_on, note: lead.service_requested || '', auto: 'Exterior Care job', dateBasis: jobDateBasis(lead) };
    if (lead.job_revenue !== null && Number.isFinite(lead.job_revenue) && lead.job_revenue >= 0) finance.push({ ...common, id: `job-${lead.id}`, kind: 'revenue', amount: lead.job_revenue, category: 'Recorded job payment' });
    if (lead.job_cost !== null && Number.isFinite(lead.job_cost) && lead.job_cost >= 0) finance.push({ ...common, id: `jobcost-${lead.id}`, kind: 'cost', amount: lead.job_cost, category: 'Recorded job cost' });
  }
  return { finance, coverage: jobFigures(done) };
}

/** Only fully paid USD orders have enough evidence for the shared USD report. */
export function shopifyFinance(orders: ShopOrder[], currency: string): FinanceEntry[] {
  if (currency.toUpperCase() !== 'USD') return [];
  return orders.flatMap(order => {
    const occurred_on = businessDay(order.createdAt);
    if (order.cancelled || order.test || order.paid !== 'PAID' || !Number.isFinite(order.total) || order.total < 0 || !occurred_on) return [];
    return [{ id: `shopify-${order.id}`, venture: 'essentials' as const, kind: 'revenue' as const, amount: order.total, occurred_on, category: 'Paid Shopify order', note: order.name, auto: 'Shopify', dateBasis: 'order-created' as const }];
  });
}

export type AnalyticsFilters = { venture: VentureId | 'all'; from: string; to: string };
const inRange = (date: string | null, filters: Pick<AnalyticsFilters, 'from' | 'to'>) => !filters.from && !filters.to || !!date && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);

/** Shared analytics uses one bounded population per metric, with current workload explicitly separate. */
export function operationalAnalytics(data: Dashboard, cards: Card[], filters: AnalyticsFilters, today: string) {
  const scope = ventureIds.filter(id => filters.venture === 'all' || id === filters.venture);
  const finance = data.finance.filter(row => scope.includes(row.venture) && inRange(row.occurred_on, filters)).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  const leads = data.leads.filter(row => scope.includes(row.venture) && inRange(businessDay(row.created_at), filters));
  const tasks = cards.filter(card => scope.includes(card.business));
  const figures = (entries: FinanceEntry[]) => {
    const revenue = entries.filter(row => row.kind === 'revenue'), costs = entries.filter(row => row.kind === 'cost');
    const revenueTotal = revenue.length ? revenue.reduce((sum, row) => sum + row.amount, 0) : null;
    const costTotal = costs.length ? costs.reduce((sum, row) => sum + row.amount, 0) : null;
    return { revenue: revenueTotal, cost: costTotal, net: revenueTotal !== null && costTotal !== null ? revenueTotal - costTotal : null, revenueEntries: revenue.length, costEntries: costs.length };
  };
  const businesses = scope.map(venture => {
    const cohort = leads.filter(lead => lead.venture === venture), won = cohort.filter(lead => lead.stage === 'Won').length, lost = cohort.filter(lead => lead.stage === 'Lost').length;
    const work = tasks.filter(card => card.business === venture);
    return { venture, ...figures(finance.filter(row => row.venture === venture)), leads: cohort.length, won, lost, winRate: won + lost ? won / (won + lost) : null, open: work.filter(card => card.stage !== 'Done').length, done: work.filter(card => card.stage === 'Done').length, overdue: work.filter(card => card.stage !== 'Done' && card.due_date && card.due_date < today).length };
  });
  const monthKeys = [...new Set(finance.map(row => row.occurred_on.slice(0, 7)))].sort();
  const months = monthKeys.map(key => ({ key, ...figures(finance.filter(row => row.occurred_on.startsWith(key))), byBusiness: scope.map(venture => ({ venture, ...figures(finance.filter(row => row.venture === venture && row.occurred_on.startsWith(key))) })) }));
  const owners = [...new Set(tasks.filter(card => card.stage !== 'Done').map(card => card.assignee || 'Unassigned'))].sort().map(owner => {
    const assigned = tasks.filter(card => card.stage !== 'Done' && (card.assignee || 'Unassigned') === owner);
    return { owner, tasks: assigned, open: assigned.length, overdue: assigned.filter(card => card.due_date && card.due_date < today).length };
  });
  return { ...figures(finance), finance, leads, tasks, businesses, months, owners };
}
