import type { ExteriorData } from './exterior';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { businessDay } from './reporting';
import { coldQuotes, pipeline, waitingLeads } from './growth-queues';

export type Exception = { id: string; text: string; href: string };

const doneDay = (l: { completed_at: string | null; updated_at: string | null; created_at: string }) => businessDay(l.completed_at || l.updated_at || l.created_at);
const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * The few numbers and exceptions the Command screen carries: this month's pace, the open pipeline, and what needs a person right now.
 * Exceptions only appear when their count is above zero. Close rate is jobs won over jobs won plus leads closed without a job; null until there is a decided lead.
 */
export function commandPulse(data: ExteriorData, jobs: JobItem[], today: string, nowMs: number, invoices?: { openCents: number; overdueCents: number; overdueCount: number }) {
  const month = today.slice(0, 7);
  const doneThisMonth = data.leads.filter(l => l.status === 'completed' && doneDay(l)?.startsWith(month));
  const withRevenue = doneThisMonth.filter(l => l.job_revenue !== null);
  const revenue = withRevenue.reduce((t, l) => t + (l.job_revenue ?? 0), 0);
  const won = data.leads.filter(l => l.status === 'completed' || l.status === 'booked').length;
  const lost = data.leads.filter(l => l.status === 'closed').length;
  const ticker = {
    revenue, jobsDone: doneThisMonth.length,
    avgJob: withRevenue.length ? revenue / withRevenue.length : null,
    closeRate: won + lost ? won / (won + lost) : null,
  };

  const lateLeads = waitingLeads(data.leads, nowMs).filter(w => w.late).length;
  const cold = coldQuotes(data.leads, nowMs).length;
  const needFigures = data.leads.filter(l => l.status === 'completed' && l.job_revenue === null).length;
  const soon = jobs.filter(j => j.status !== 'cancelled' && j.status !== 'denied' && j.date >= today && j.date <= addDays(today, 1) && j.quote === null).length;
  const exceptions: Exception[] = [
    lateLeads ? { id: 'late-leads', text: `${lateLeads} new lead${lateLeads === 1 ? '' : 's'} waiting 30+ min for a reply`, href: '/growth' } : null,
    cold ? { id: 'cold', text: `${cold} quote${cold === 1 ? '' : 's'} going cold`, href: '/growth' } : null,
    soon ? { id: 'no-quote', text: `${soon} job${soon === 1 ? '' : 's'} today or tomorrow with no price`, href: '/b/exterior/bookings' } : null,
    invoices && invoices.overdueCount ? { id: 'overdue-invoices', text: `${invoices.overdueCount} invoice${invoices.overdueCount === 1 ? '' : 's'} overdue, ${(invoices.overdueCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} owed`, href: '/invoices' } : null,
    needFigures ? { id: 'figures', text: `${needFigures} finished job${needFigures === 1 ? '' : 's'} with no revenue entered`, href: '/b/exterior/field' } : null,
  ].filter((e): e is Exception => e !== null);

  return { ticker, pipeline: pipeline(data.leads), exceptions, owedCents: invoices ? invoices.openCents : null };
}
