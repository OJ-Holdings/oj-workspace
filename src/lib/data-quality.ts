import { isRealPhone } from './exterior-ops';
import { planDedupe, type SyncLead } from './exterior-sync';
import type { ExteriorData, ExtLead } from './exterior';

export type QualityCheck = {
  id: string;
  title: string;
  /** Records failing the check, and how many were checked. */
  count: number;
  of: number;
  /** A few names to recognise the problem by. */
  sample: string[];
  /** Where it gets fixed, relative to the workspace base. */
  href: string;
  /** What the fix link says. */
  action: string;
};

const OPEN = ['new', 'contacted', 'following_up', 'booked'];
const names = (rows: { name: string | null }[]) => rows.slice(0, 3).map(r => r.name || 'Unnamed');
const blankSource = (s: string | null) => { const v = (s ?? '').trim().toLowerCase(); return v === '' || v === 'other'; };

/**
 * The data quality center (master plan section 9): what is missing or doubtful in the customer and job records, each with where to fix it.
 * Only checks with something to fix are returned, worst first; `tidy` is the share of all checked fields that are in order.
 */
export function dataQuality(data: ExteriorData, today: string): { checks: QualityCheck[]; tidy: number | null } {
  const completed = data.leads.filter(l => l.status === 'completed');
  const open = data.leads.filter(l => OPEN.includes(l.status ?? ''));
  const byId = new Map<string, ExtLead>(data.leads.map(l => [l.id, l]));
  const upcoming = data.bookings.filter(b => b.date >= today && b.status !== 'denied' && b.status !== 'cancelled');
  const upcomingLeads = upcoming.map(b => byId.get(b.lead_id ?? '')).filter((l): l is ExtLead => !!l);

  const all: QualityCheck[] = [];
  const add = (id: string, title: string, bad: { name: string | null }[], of: number, href: string, action: string) => all.push({ id, title, count: bad.length, of, sample: names(bad), href, action });

  add('no-revenue', 'Finished jobs with no revenue entered', completed.filter(l => l.job_revenue === null), completed.length, '/b/exterior/field', 'Enter revenue');
  add('no-cost', 'Finished jobs with no costs entered', completed.filter(l => l.job_cost === null), completed.length, '/b/exterior/jobs', 'Enter costs');
  add('upcoming-no-quote', 'Upcoming jobs with no price', upcomingLeads.filter(l => l.quote_amount === null), upcomingLeads.length, '/b/exterior/bookings', 'Add a price');
  add('upcoming-no-address', 'Upcoming jobs with no address', upcomingLeads.filter(l => !(l.address ?? '').trim()), upcomingLeads.length, '/b/exterior/bookings', 'Add the address');
  add('open-no-phone', 'Open customers with no usable phone number', open.filter(l => !isRealPhone(l.phone) || !(l.phone ?? '').replace(/\D/g, '')), open.length, '/b/exterior/leads', 'Add a number');
  add('no-source', 'Leads with no lead source', data.leads.filter(l => blankSource(l.source)), data.leads.length, '/b/exterior/leads', 'Tag sources');

  const dupes = planDedupe(data.leads.map((l): SyncLead => ({ ...l, manually_updated_fields: null })));
  const dupeLeads = dupes.flatMap(m => [m.keep, ...m.remove]).map(id => byId.get(id)).filter((l): l is ExtLead => !!l);
  all.push({ id: 'duplicates', title: 'Customers entered more than once', count: dupes.length, of: data.leads.length, sample: names(dupeLeads), href: '/b/exterior/settings', action: 'Merge duplicates' });

  const checked = all.reduce((t, c) => t + c.of, 0), failing = all.reduce((t, c) => t + Math.min(c.count, c.of), 0);
  return { checks: all.filter(c => c.count > 0).sort((a, b) => b.count / Math.max(1, b.of) - a.count / Math.max(1, a.of)), tidy: checked ? Math.round(((checked - failing) / checked) * 100) : null };
}
