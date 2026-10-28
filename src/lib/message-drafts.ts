import { jobDate, type ExteriorData, type ExtLead } from './exterior';
import { blockLabel } from './exterior-ops';
import { rebookCandidates } from './exterior-rebook';
import { coldQuotes, waitingLeads } from './growth-queues';
import { businessDay } from './reporting';

export type DraftKind = 'new-lead' | 'quote' | 'reminder' | 'thanks' | 'rebook';
export type Draft = { id: string; kind: DraftKind; why: string; lead: ExtLead; body: string };

export const draftKindLabel: Record<DraftKind, string> = { 'new-lead': 'New leads', quote: 'Quote follow-ups', reminder: 'Tomorrow\'s jobs', thanks: 'After the job', rebook: 'Time to rebook' };

const TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'miss']);
const letters = (w: string) => w.replace(/[^\p{L}'’-]/gu, '');
const cap = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);
/** How the customer is greeted: their first name, or a title and last name ("Dr James") when the record starts with a title. Stray punctuation is dropped. */
const firstName = (name: string | null) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'there';
  const head = letters(parts[0]);
  if (TITLES.has(head.toLowerCase()) && parts.length > 1) { const last = letters(parts[parts.length - 1]); return last ? `${cap(head)} ${cap(last)}` : 'there'; }
  return head ? cap(head) : 'there';
};
const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const what = (l: ExtLead) => (l.service_requested ?? '').trim().toLowerCase();
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Ready-to-send message drafts built from the records (master plan 6.9 starter rules, at the "draft anything" level: a person reads each one,
 * copies it and sends it themselves, and nothing is ever sent from here). Plain templates, no invented facts: names, services, prices and times
 * come from the record, and a draft with no price or service simply leaves that part out.
 * `from` is the sender's first name.
 */
export function messageDrafts(data: ExteriorData, today: string, nowMs: number, from: string): Draft[] {
  const sign = `${from || 'OJ Exterior Care'}${from ? ', OJ Exterior Care' : ''}`;
  const out: Draft[] = [];
  const byId = new Map(data.leads.map(l => [l.id, l]));

  for (const { lead: l, minutes } of waitingLeads(data.leads, nowMs).slice(0, 8)) {
    out.push({ id: `new-${l.id}`, kind: 'new-lead', lead: l, why: minutes < 60 ? `Asked ${minutes} min ago` : `Waiting ${Math.round(minutes / 60)} h`,
      body: `Hi ${firstName(l.name)}, thanks for reaching out to OJ Exterior Care${what(l) ? ` about ${what(l)}` : ''}. ${sign} here. I'd be glad to get you a quote. When is a good time for a quick call?` });
  }

  for (const { lead: l, days, step } of coldQuotes(data.leads, nowMs).slice(0, 8)) {
    const job = `${what(l) ? `the ${what(l)} quote` : 'the quote'}${l.quote_amount ? ` (${usd(l.quote_amount)})` : ''}`;
    const body = days >= 14
      ? `Hi ${firstName(l.name)}, this is my last check-in on ${job}. If the timing is not right, no problem at all, just let me know and I will close it out. Thanks, ${sign}`
      : days >= 7
        ? `Hi ${firstName(l.name)}, following up on ${job}. I can get you on the schedule whenever you are ready, and I am happy to adjust anything. Thanks, ${sign}`
        : `Hi ${firstName(l.name)}, it is ${sign}. Just checking in on ${job}. Let me know if you have any questions or want to change anything.`;
    out.push({ id: `quote-${l.id}-${step.slice(0, 5)}`, kind: 'quote', lead: l, why: step, body });
  }

  const tomorrow = addDays(today, 1);
  for (const b of data.bookings.filter(b => b.date === tomorrow && b.status === 'confirmed')) {
    const l = byId.get(b.lead_id ?? '');
    if (!l) continue;
    const day = new Date(`${tomorrow}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    out.push({ id: `remind-${b.id}`, kind: 'reminder', lead: l, why: `${day}, ${blockLabel(b.time_block)}`,
      body: `Hi ${firstName(l.name)}, a reminder that OJ Exterior Care is scheduled for ${day}${b.time_block ? `, ${blockLabel(b.time_block)}` : ''}${what(l) ? ` for ${what(l)}` : ''}. Please reply if anything changes. Thanks, ${sign}` });
  }

  const recent = addDays(today, -3);
  for (const l of data.leads.filter(l => l.status === 'completed')) {
    const done = businessDay(jobDate(l));
    if (!done || done < recent || done > addDays(today, -1)) continue;
    out.push({ id: `thanks-${l.id}`, kind: 'thanks', lead: l, why: `Finished ${new Date(`${done}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      body: `Hi ${firstName(l.name)}, thank you for choosing OJ Exterior Care. If you are happy with the work, a quick review on Google would really help a small business like ours. Thanks again, ${sign}` });
  }

  for (const l of rebookCandidates(data.leads, new Date(nowMs), 11).slice(0, 8)) {
    out.push({ id: `rebook-${l.id}`, kind: 'rebook', lead: l, why: `Last service ${new Date(jobDate(l)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
      body: `Hi ${firstName(l.name)}, it is ${sign}. It has been about a year since we did${what(l) ? ` your ${what(l)}` : ' your last job'}. Would you like to get on the schedule for this spring? Just reply and I will set it up.` });
  }
  return out;
}

/** Drafts grouped in the order they should be worked: tomorrow's jobs and new leads first. */
export function groupDrafts(drafts: Draft[]): { kind: DraftKind; items: Draft[] }[] {
  const order: DraftKind[] = ['reminder', 'new-lead', 'quote', 'thanks', 'rebook'];
  return order.map(kind => ({ kind, items: drafts.filter(d => d.kind === kind) })).filter(g => g.items.length > 0);
}
