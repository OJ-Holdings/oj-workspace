import type { ExtLead } from './exterior';

const OPEN = ['new', 'contacted', 'following_up'];
const when = (iso: string | null) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null; };

export type WaitingLead = { lead: ExtLead; minutes: number; late: boolean };
export type ColdQuote = { lead: ExtLead; days: number; step: string; big: boolean };

/** A quote at or above this is a big proposal: it gets chased on a schedule and flagged. */
export const BIG_QUOTE = 1000;

/** The follow-up cadence for a quote that has gone quiet: day 3, day 7, then a last check-in at day 14. */
export const cadenceStep = (days: number) => days >= 14 ? 'Day 14: last check-in' : days >= 7 ? 'Day 7: second nudge' : 'Day 3: first nudge';

/** New leads nobody has answered yet, oldest first. Past `lateAfter` minutes they are flagged late: speed to the first reply decides who wins the job. */
export function waitingLeads(leads: ExtLead[], nowMs: number, lateAfter = 30): WaitingLead[] {
  return leads
    .filter(l => l.status === 'new')
    .map(l => ({ lead: l, minutes: Math.max(0, Math.round((nowMs - (when(l.created_at) ?? nowMs)) / 60_000)) }))
    .map(w => ({ ...w, late: w.minutes >= lateAfter }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Open leads holding a quote that nobody has touched for `days` days, biggest quote first. Last touch is the last update, else creation. */
export function coldQuotes(leads: ExtLead[], nowMs: number, days = 3): ColdQuote[] {
  return leads
    .filter(l => OPEN.includes(l.status ?? '') && l.status !== 'new' && l.quote_amount !== null && l.quote_amount > 0)
    .map(l => ({ lead: l, days: Math.floor((nowMs - (when(l.updated_at) ?? when(l.created_at) ?? nowMs)) / 86_400_000) }))
    .map(q => ({ ...q, step: cadenceStep(q.days), big: (q.lead.quote_amount ?? 0) >= BIG_QUOTE }))
    .filter(q => q.days >= days)
    .sort((a, b) => (b.lead.quote_amount ?? 0) - (a.lead.quote_amount ?? 0));
}

/** Open pipeline by stage with the quoted value sitting in it. Quotes are not money in. */
export function pipeline(leads: ExtLead[]) {
  const stage = (status: string) => { const rows = leads.filter(l => l.status === status); return { count: rows.length, quoted: rows.reduce((t, l) => t + (l.quote_amount ?? 0), 0) }; };
  return { new: stage('new'), contacted: stage('contacted'), following_up: stage('following_up'), booked: stage('booked') };
}
