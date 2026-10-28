import { jobDate, type ExtLead } from './exterior';
import { businessDay } from './reporting';

export type Customer = { id: string; kind: 'person' | 'company'; name: string; phone: string | null; email: string | null; notes: string; created_at: string };
export type Property = { id: string; customer_id: string; label: string; address: string; access_notes: string; water_notes: string; surface_notes: string };
export type LeadLink = { lead_id: string; customer_id: string; property_id: string | null };

export type Segment = 'all' | 'repeat' | 'top' | 'due' | 'open' | 'no-phone';
export const segmentLabels: Record<Segment, string> = { all: 'Everyone', repeat: 'Repeat customers', top: 'Top 20', due: 'Due to rebook', open: 'Open job', 'no-phone': 'No usable phone' };

export type DirectoryRow = {
  customer: Customer; properties: Property[]; jobs: ExtLead[];
  completed: number;
  /** Sum of recorded revenue on finished jobs; null when none of them has a figure yet (unknown, not zero). */
  lifetimeRevenue: number | null;
  /** Date of the most recent finished job, or null. */
  lastService: string | null;
  /** A year after the last service: when this customer is due again. */
  nextDue: string | null;
  hasOpenJob: boolean;
};

const OPEN = ['new', 'contacted', 'following_up', 'booked'];
const addYear = (key: string) => `${Number(key.slice(0, 4)) + 1}${key.slice(4)}`;

/** One row per customer with the jobs linked to them, their lifetime value and when they are next due. Jobs with no link are not in any row. */
export function buildDirectory(customers: Customer[], properties: Property[], links: LeadLink[], leads: ExtLead[]): DirectoryRow[] {
  const leadById = new Map(leads.map(l => [l.id, l]));
  const propsBy = new Map<string, Property[]>();
  for (const p of properties) propsBy.set(p.customer_id, [...(propsBy.get(p.customer_id) ?? []), p]);
  const jobsBy = new Map<string, ExtLead[]>();
  for (const k of links) { const l = leadById.get(k.lead_id); if (l) jobsBy.set(k.customer_id, [...(jobsBy.get(k.customer_id) ?? []), l]); }
  return customers.map(customer => {
    const jobs = (jobsBy.get(customer.id) ?? []).sort((a, b) => jobDate(b).localeCompare(jobDate(a)));
    const done = jobs.filter(j => j.status === 'completed');
    const withRevenue = done.filter(j => j.job_revenue !== null);
    const lastService = done.length ? businessDay(jobDate(done[0])) : null;
    return {
      customer, properties: propsBy.get(customer.id) ?? [], jobs, completed: done.length,
      lifetimeRevenue: withRevenue.length ? withRevenue.reduce((t, j) => t + (j.job_revenue ?? 0), 0) : null,
      lastService, nextDue: lastService ? addYear(lastService) : null,
      hasOpenJob: jobs.some(j => OPEN.includes(j.status ?? '')),
    };
  });
}

const usable = (phone: string | null) => (phone ?? '').replace(/\D/g, '').length >= 10;

/** Filters the directory to a segment and a search. Top 20 is the twenty highest lifetime revenues; due is a customer whose last finished job was 11 or more months ago. */
export function filterDirectory(rows: DirectoryRow[], segment: Segment, search: string, today: string): DirectoryRow[] {
  const q = search.trim().toLowerCase();
  const cutoff = (() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 11); return d.toISOString().slice(0, 10); })();
  const top = new Set([...rows].filter(r => (r.lifetimeRevenue ?? 0) > 0).sort((a, b) => (b.lifetimeRevenue ?? 0) - (a.lifetimeRevenue ?? 0)).slice(0, 20).map(r => r.customer.id));
  return rows.filter(r => {
    if (segment === 'repeat' && r.completed < 2) return false;
    if (segment === 'top' && !top.has(r.customer.id)) return false;
    if (segment === 'due' && !(r.lastService && r.lastService <= cutoff && !r.hasOpenJob)) return false;
    if (segment === 'open' && !r.hasOpenJob) return false;
    if (segment === 'no-phone' && usable(r.customer.phone)) return false;
    if (!q) return true;
    return [r.customer.name, r.customer.phone ?? '', ...r.properties.map(p => p.address)].some(v => v.toLowerCase().includes(q));
  }).sort((a, b) => (b.lifetimeRevenue ?? -1) - (a.lifetimeRevenue ?? -1) || a.customer.name.localeCompare(b.customer.name));
}

export const segmentCounts = (rows: DirectoryRow[], today: string): Record<Segment, number> =>
  Object.fromEntries((Object.keys(segmentLabels) as Segment[]).map(s => [s, filterDirectory(rows, s, '', today).length])) as Record<Segment, number>;
