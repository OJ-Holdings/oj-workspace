import { dollarsToCents } from './invoices';
import { cadenceStep } from './growth-queues';

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type ProposalLine = { id: string; position: number; description: string; detail: string; quantity: number; unit_price_cents: number; amount_cents: number; optional: boolean };
export type Proposal = {
  id: string; number: string; division: string; lead_id: string | null; customer_name: string; customer_email: string | null; site_address: string;
  status: ProposalStatus; valid_until: string; payment_terms: string; terms: string; exclusions: string; notes: string;
  subtotal_cents: number; discount_cents: number; total_cents: number; sent_on: string | null; decided_on: string | null; decision_note: string; created_at: string;
  lines: ProposalLine[];
  /** The customer's online decision, once there is one (needs the portal SQL). */
  signed?: { decision: 'accepted' | 'declined'; name: string; at: string; total_cents: number; hash: string } | null;
};
export type DraftLine = { description: string; detail: string; quantity: string; price: string; optional: boolean };

export const paymentTermOptions = ['ACH, net 30', 'Due on receipt', 'Per purchase order', 'ACH on completion'];
// Starting text taken from the company's own commercial proposals; every field is editable before the proposal is saved.
export const DEFAULT_TERMS = 'Recurring plans are a 12-month agreement with 30 days written cancellation. Certificate of insurance available on request.';
export const DEFAULT_EXCLUSIONS = 'Restoration of staining, etching or mineral deposits is not guaranteed. Water access is provided by the client.';

export const statusLabel: Record<ProposalStatus, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' };

/** A sent proposal past its valid-until date reads as expired even before anyone marks it. */
export const effectiveStatus = (p: Pick<Proposal, 'status' | 'valid_until'>, today: string): ProposalStatus => (p.status === 'sent' && p.valid_until < today ? 'expired' : p.status);

/**
 * What the builder shows while a proposal is being written. Optional lines are priced but left out of the total (the customer may choose them).
 * `problem` says what stops it being saved yet, or null when it is ready.
 */
export function draftTotals(lines: DraftLine[], discount: string) {
  let subtotalCents = 0, optionalCents = 0, problem: string | null = null, counted = 0;
  for (const l of lines) {
    if (!l.description.trim() && !l.price.trim()) continue;
    const price = dollarsToCents(l.price), qty = Number(l.quantity);
    if (!l.description.trim()) { problem = 'Every priced line needs a description.'; continue; }
    if (price === null || !Number.isFinite(qty) || qty <= 0) { problem = 'Every line needs a price and a quantity above zero.'; continue; }
    const amount = Math.round(qty * price);
    if (l.optional) optionalCents += amount; else { subtotalCents += amount; counted += 1; }
  }
  const discountCents = discount.trim() === '' ? 0 : dollarsToCents(discount) ?? -1;
  if (discountCents < 0) problem = problem ?? 'The discount must be an amount above zero, or blank.';
  else if (counted === 0) problem = problem ?? 'Add at least one line that is not optional.';
  else if (discountCents >= subtotalCents) problem = problem ?? 'The discount must be less than the subtotal.';
  return { subtotalCents, optionalCents, discountCents: Math.max(0, discountCents), totalCents: Math.max(0, subtotalCents - Math.max(0, discountCents)), problem };
}

/** Days since a sent proposal went out and which follow-up step that is (day 3, 7, 14), or null when it is not waiting on a reply or it is too soon. */
export function followUp(p: Pick<Proposal, 'status' | 'sent_on' | 'valid_until'>, today: string): { days: number; step: string } | null {
  if (effectiveStatus(p, today) !== 'sent' || !p.sent_on) return null;
  const days = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${p.sent_on}T12:00:00Z`)) / 86_400_000);
  return days >= 3 ? { days, step: cadenceStep(days) } : null;
}

/** The commercial pipeline at a glance: what is out waiting, what was won, and what needs a nudge. */
export function summariseProposals(proposals: Proposal[], today: string) {
  const status = (p: Proposal) => effectiveStatus(p, today);
  const out = proposals.filter(p => status(p) === 'sent');
  const won = proposals.filter(p => p.status === 'accepted');
  return {
    outCount: out.length, outCents: out.reduce((t, p) => t + p.total_cents, 0),
    wonCount: won.length, wonCents: won.reduce((t, p) => t + p.total_cents, 0),
    draftCount: proposals.filter(p => p.status === 'draft').length,
    needNudge: out.filter(p => followUp(p, today)).length,
  };
}
