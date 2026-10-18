// The existing Exterior Care records (leads, texts, bookings, door knocking),
// read from the tables the oj-sms-system server owns. The workspace only reads
// them. Unknown stays unknown: a quote is not a payment and a missing figure is
// not zero.

export type ExtLead = { id: string; name: string | null; phone: string | null; address: string | null; service_requested: string | null; quote_amount: number | null; status: string | null; source: string | null; notes: string | null; job_revenue: number | null; job_cost: number | null; created_at: string; updated_at: string | null; completed_at: string | null };
export type ExtActivity = { id: string; operator: string | null; action: string | null; description: string | null; lead_name: string | null; created_at: string };
export type ExtBooking = { id: string; lead_id: string | null; date: string; time_block: string | null; status: string | null };
export type ExtSession = { id: string; session_date: string; knocked_by: string | null; area: string | null; start_time?: string | null; end_time?: string | null; doors_knocked: number | null; answers: number | null; interested: number | null; quotes_given: number | null; jobs_scheduled: number | null; job_total: number | null; notes?: string | null };
export type ExtQuote = { id: string; name: string | null; phone: string | null; email: string | null; address: string | null; service_needed: string | null; description: string | null; property_type: string | null; business_name: string | null; recurring_interest: boolean | null; created_at: string };
/** Null until the database update in supabase/schemas/exterior-extras.sql has been applied. */
export type ExtExtras = { goal: number | null; upgrades: Record<string, true>; quotes: ExtQuote[]; settings: Record<string, string> } | null;
export type ExteriorData = { leads: ExtLead[]; bookings: ExtBooking[]; sessions: ExtSession[]; activity: ExtActivity[]; extras: ExtExtras; coverage?: { leads: { loaded: number; total: number | null }; bookings: { loaded: number; total: number | null }; sessions: { loaded: number; total: number | null } } };
/** Every change the workspace makes reports back this way, so the screen can say what happened. */
export type Done<T = object> = ({ ok: true } & T) | { ok: false; message: string };
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
const known = (value: number | null) => value !== null && Number.isFinite(value) && value >= 0;
const total = (rows: Pick<ExtLead, 'job_revenue' | 'job_cost'>[], key: 'job_revenue' | 'job_cost') => {
  const recorded = rows.filter(l => known(l[key]));
  return recorded.length ? recorded.reduce((sum, l) => sum + (l[key] as number), 0) : null;
};
/** When a job counts as done: the day it was completed, or failing that the day it was last changed (the old system's own rule). */
export const jobDate = (l: Pick<ExtLead, 'completed_at' | 'updated_at' | 'created_at'>) => l.completed_at || l.updated_at || l.created_at;
export const jobDateBasis = (l: Pick<ExtLead, 'completed_at' | 'updated_at'>) => l.completed_at ? 'completion' as const : l.updated_at ? 'updated-estimate' as const : 'created-estimate' as const;

/** Recorded job figures, not an accounting profit statement. Costs stay unknown until entered. */
export function jobFigures(rows: Pick<ExtLead, 'job_revenue' | 'job_cost' | 'completed_at' | 'updated_at'>[]) {
  const matched = rows.filter(l => known(l.job_revenue) && known(l.job_cost));
  const revenueJobs = rows.filter(l => known(l.job_revenue)).length;
  const costJobs = rows.filter(l => known(l.job_cost)).length;
  const revenue = total(rows, 'job_revenue');
  return {
    jobs: rows.length, revenue, cost: total(rows, 'job_cost'), revenueJobs, costJobs,
    missingRevenue: rows.length - revenueJobs, missingCosts: rows.length - costJobs,
    matchedJobs: matched.length,
    contribution: matched.length ? matched.reduce((sum, l) => sum + (l.job_revenue as number) - (l.job_cost as number), 0) : null,
    estimatedDateJobs: rows.filter(l => jobDateBasis(l) !== 'completion').length,
    average: revenueJobs ? (revenue as number) / revenueJobs : null,
  };
}

/** Completed work grouped by its recorded completion date, not by a claimed collection date. */
export function summariseJobs(leads: ExtLead[], monthOf: (iso: string) => string) {
  const done = leads.filter(l => l.status === 'completed');
  const row = (label: string, rows: ExtLead[]) => ({ label, ...jobFigures(rows) });
  return {
    ...jobFigures(done),
    byMonth: group(done, l => monthOf(jobDate(l))).map(([m, rows]) => row(m, rows)).sort((a, b) => b.label.localeCompare(a.label)),
    byService: group(done, l => l.service_requested?.trim() || 'Unspecified').map(([s, rows]) => row(s, rows)).sort((a, b) => (b.revenue ?? -1) - (a.revenue ?? -1)),
    bySource: group(leads, l => sourceLabel(l.source)).map(([source, rows]) => { const won = rows.filter(l => l.status === 'completed' || l.status === 'booked'); return { source, leads: rows.length, won: won.length, rate: won.length / rows.length, revenue: total(rows.filter(l => l.status === 'completed'), 'job_revenue') }; }).sort((a, b) => b.leads - a.leads),
  };
}

/** Totals across sessions; each rate is null when there is nothing to divide by. */
export function summariseSessions(sessions: ExtSession[]) {
  const sum = (key: 'doors_knocked' | 'answers' | 'interested' | 'quotes_given' | 'jobs_scheduled' | 'job_total') => sessions.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  const doors = sum('doors_knocked'), answers = sum('answers'), jobs = sum('jobs_scheduled'), jobTotal = sum('job_total');
  return { sessions: sessions.length, doors, answers, interested: sum('interested'), quotes: sum('quotes_given'), jobs, jobTotal, answerRate: doors ? answers / doors : null, perDoor: doors ? jobTotal / doors : null };
}

/** The door-knocking funnel, this week (Monday on), the best areas by money per door, and the best single session. */
export function doorDetails(sessions: ExtSession[], weekStart: string) {
  const week = summariseSessions(sessions.filter(s => s.session_date >= weekStart));
  const areas = new Map<string, ExtSession[]>();
  for (const s of sessions) { const a = s.area?.trim(); if (a) areas.set(a, [...(areas.get(a) ?? []), s]); }
  const byArea = [...areas].map(([area, list]) => ({ area, ...summariseSessions(list), closeRate: (() => { const t = summariseSessions(list); return t.quotes ? t.jobs / t.quotes : null; })() }))
    .sort((a, b) => (b.perDoor ?? -1) - (a.perDoor ?? -1));
  const best = sessions.filter(s => (s.doors_knocked ?? 0) > 0 && (s.job_total ?? 0) > 0).map(s => ({ ...s, perDoor: (s.job_total as number) / (s.doors_knocked as number) })).sort((a, b) => b.perDoor - a.perDoor)[0] ?? null;
  return { week, byArea, best };
}

