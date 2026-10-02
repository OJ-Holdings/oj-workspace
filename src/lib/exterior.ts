// The existing Exterior Care records (leads, texts, bookings, door knocking),
// read from the tables the oj-sms-system server owns. The workspace only reads
// them. Unknown stays unknown: a quote is not a payment and a missing figure is
// not zero.

export type ExtLead = { id: string; name: string | null; phone: string | null; address: string | null; service_requested: string | null; quote_amount: number | null; status: string | null; source: string | null; job_revenue: number | null; job_cost: number | null; created_at: string; updated_at: string | null; completed_at: string | null };
export type ExtBooking = { id: string; lead_id: string | null; date: string; time_block: string | null; status: string | null };
export type ExtSession = { id: string; session_date: string; knocked_by: string | null; area: string | null; doors_knocked: number | null; answers: number | null; interested: number | null; quotes_given: number | null; jobs_scheduled: number | null; job_total: number | null };
export type ExtMessage = { id: string; lead_id: string | null; direction: string | null; body: string | null; created_at: string };
export type ExtQuote = { id: string; name: string | null; phone: string | null; email: string | null; address: string | null; service_needed: string | null; description: string | null; property_type: string | null; business_name: string | null; recurring_interest: boolean | null; created_at: string };
/** Null until the database update in supabase/schemas/exterior-extras.sql has been applied. */
export type ExtExtras = { goal: number | null; upgrades: Record<string, true>; quotes: ExtQuote[] } | null;
export type ExteriorData = { leads: ExtLead[]; bookings: ExtBooking[]; sessions: ExtSession[]; messages: ExtMessage[]; messagesTruncated: boolean; extras: ExtExtras };
export type ExteriorResult = { ok: true; data: ExteriorData } | { ok: false; reason: 'no-access' | 'failed' };

export const openStatuses = ['new', 'contacted', 'following_up', 'booked'];
export const statusLabel = (s: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : 'Unknown';
/** The old app wrote the same source several ways (dtd, DTD, door-to-door). */
export const sourceLabel = (s: string | null) => {
  const v = (s ?? '').trim().toLowerCase();
  if (!v) return 'Unknown';
  if (v === 'dtd' || v === 'door-to-door') return 'Door to door';
  return v.charAt(0).toUpperCase() + v.slice(1);
};

export function summariseLeads(leads: ExtLead[]) {
  const completed = leads.filter(l => l.status === 'completed');
  const withRevenue = completed.filter(l => l.job_revenue !== null);
  const byStatus = new Map<string, number>();
  for (const l of leads) byStatus.set(l.status ?? 'unknown', (byStatus.get(l.status ?? 'unknown') ?? 0) + 1);
  return {
    total: leads.length, open: leads.filter(l => openStatuses.includes(l.status ?? '')).length, completed: completed.length,
    revenue: withRevenue.length ? withRevenue.reduce((s, l) => s + (l.job_revenue as number), 0) : null, revenueJobs: withRevenue.length,
    byStatus: [...byStatus].sort((a, b) => b[1] - a[1]),
  };
}

const group = <T,>(rows: T[], key: (row: T) => string) => { const m = new Map<string, T[]>(); for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]); return [...m]; };
const paid = (rows: ExtLead[]) => rows.reduce((s, l) => s + (l.job_revenue ?? 0), 0);
const spent = (rows: ExtLead[]) => rows.reduce((s, l) => s + (l.job_cost ?? 0), 0);
/** When a job counts as done: the day it was completed, or failing that the day it was last changed (the old system's own rule). */
export const jobDate = (l: ExtLead) => l.completed_at || l.updated_at || l.created_at;

/** Completed jobs: money paid, costs and profit, by month and by service, plus how each lead source converts. Profit counts only the costs that were entered. */
export function summariseJobs(leads: ExtLead[], monthOf: (iso: string) => string) {
  const done = leads.filter(l => l.status === 'completed');
  const row = (label: string, rows: ExtLead[]) => ({ label, jobs: rows.length, revenue: paid(rows), cost: spent(rows), profit: paid(rows) - spent(rows) });
  return {
    jobs: done.length, revenue: paid(done), cost: spent(done), profit: paid(done) - spent(done), costJobs: done.filter(l => l.job_cost !== null).length,
    average: done.some(l => l.job_revenue !== null) ? paid(done) / done.filter(l => l.job_revenue !== null).length : null,
    byMonth: group(done, l => monthOf(jobDate(l))).map(([m, rows]) => row(m, rows)).sort((a, b) => b.label.localeCompare(a.label)),
    byService: group(done, l => l.service_requested?.trim() || 'Unspecified').map(([s, rows]) => row(s, rows)).sort((a, b) => b.revenue - a.revenue),
    bySource: group(leads, l => sourceLabel(l.source)).map(([source, rows]) => { const won = rows.filter(l => l.status === 'completed' || l.status === 'booked'); return { source, leads: rows.length, won: won.length, rate: won.length / rows.length, revenue: paid(rows.filter(l => l.status === 'completed')) }; }).sort((a, b) => b.leads - a.leads),
  };
}

/** Totals across sessions; each rate is null when there is nothing to divide by. */
export function summariseSessions(sessions: ExtSession[]) {
  const sum = (key: 'doors_knocked' | 'answers' | 'interested' | 'quotes_given' | 'jobs_scheduled' | 'job_total') => sessions.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  const doors = sum('doors_knocked'), answers = sum('answers'), jobs = sum('jobs_scheduled'), jobTotal = sum('job_total');
  return { sessions: sessions.length, doors, answers, interested: sum('interested'), quotes: sum('quotes_given'), jobs, jobTotal, answerRate: doors ? answers / doors : null, perDoor: doors ? jobTotal / doors : null };
}

/** Texts grouped by lead, the most recently active conversation first, each in the order it was sent. */
export function threads(messages: ExtMessage[], leads: ExtLead[]) {
  const names = new Map(leads.map(l => [l.id, l.name || 'Unnamed lead']));
  const groups = new Map<string, ExtMessage[]>();
  for (const m of messages) { const key = m.lead_id ?? ''; groups.set(key, [...(groups.get(key) ?? []), m]); }
  return [...groups].map(([leadId, list]) => {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { leadId, name: names.get(leadId) ?? 'Unknown lead', messages: sorted, last: sorted[sorted.length - 1].created_at };
  }).sort((a, b) => b.last.localeCompare(a.last));
}
