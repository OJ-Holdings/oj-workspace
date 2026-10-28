'use server';

import { createHash, randomBytes } from 'node:crypto';
import { requireMember } from '@/lib/supabase';
import { dollarsToCents, isMissingTable } from '@/lib/invoices';
import type { Proposal, ProposalLine, ProposalStatus } from '@/lib/proposals';
import type { ActionResult } from './invoice-actions';

// Proposals are created and moved between statuses only through the database functions in docs/db-change-proposals/RUN-ME-2026-10-28-proposals.sql.
// Until an owner has run that SQL these actions report 'not-set-up' and change nothing.

export type ProposalsLoad = { ok: true; proposals: Proposal[] } | { ok: false; reason: 'not-set-up' | 'no-access' | 'failed' };

const DIVISIONS = ['exterior', 'solutions', 'essentials', 'content', 'shared'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const friendly = (message: string | undefined) => (message ?? 'That did not go through.').replace(/^.*?(ERROR:\s*)/i, '').slice(0, 240);

type Row = Record<string, unknown>;
const toLine = (r: Row): ProposalLine => ({
  id: String(r.id), position: Number(r.position), description: String(r.description), detail: String(r.detail ?? ''), quantity: Number(r.quantity),
  unit_price_cents: Number(r.unit_price_cents), amount_cents: Number(r.amount_cents), optional: Boolean(r.optional),
});
const toProposal = (r: Row, lines: ProposalLine[]): Proposal => ({
  id: String(r.id), number: String(r.number), division: String(r.division), lead_id: (r.lead_id as string | null) ?? null, customer_name: String(r.customer_name),
  customer_email: (r.customer_email as string | null) ?? null, site_address: String(r.site_address ?? ''), status: r.status as ProposalStatus, valid_until: String(r.valid_until),
  payment_terms: String(r.payment_terms ?? ''), terms: String(r.terms ?? ''), exclusions: String(r.exclusions ?? ''), notes: String(r.notes ?? ''),
  subtotal_cents: Number(r.subtotal_cents), discount_cents: Number(r.discount_cents), total_cents: Number(r.total_cents),
  sent_on: (r.sent_on as string | null) ?? null, decided_on: (r.decided_on as string | null) ?? null, decision_note: String(r.decision_note ?? ''), created_at: String(r.created_at), lines,
});

export async function loadProposals(org: string): Promise<ProposalsLoad> {
  let ctx;
  try { ctx = await requireMember(org, true); } catch { return { ok: false, reason: 'no-access' }; }
  const { client } = ctx;
  const props = await client.from('oj_proposals').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(200);
  if (props.error) return { ok: false, reason: isMissingTable(props.error) ? 'not-set-up' : 'failed' };
  const ids = (props.data ?? []).map(p => p.id as string);
  const lines = ids.length ? await client.from('oj_proposal_lines').select('*').eq('organization_id', org).in('proposal_id', ids).order('position') : { data: [] as Row[], error: null };
  if (lines.error) return { ok: false, reason: 'failed' };
  // The customer's online decision, when the portal SQL has been run; without it proposals simply have no signature record.
  const decisions = await client.from('oj_proposal_acceptances').select('proposal_id,decision,signer_name,created_at,agreed_total_cents,document_hash').eq('organization_id', org).order('created_at');
  const signed = new Map<string, NonNullable<Proposal['signed']>>();
  if (!decisions.error) for (const d of (decisions.data ?? []) as Row[]) signed.set(String(d.proposal_id), { decision: d.decision as 'accepted' | 'declined', name: String(d.signer_name), at: String(d.created_at), total_cents: Number(d.agreed_total_cents), hash: String(d.document_hash) });
  const byProposal = new Map<string, ProposalLine[]>();
  for (const l of (lines.data ?? []) as Row[]) byProposal.set(String(l.proposal_id), [...(byProposal.get(String(l.proposal_id)) ?? []), toLine(l)]);
  return { ok: true, proposals: (props.data ?? []).map(p => ({ ...toProposal(p as Row, byProposal.get(String(p.id)) ?? []), signed: signed.get(String(p.id)) ?? null })) };
}

export type CreateProposalInput = {
  name: string; email: string; address: string; leadId?: string | null; division: string; validUntil: string; paymentTerms: string; terms: string; exclusions: string; notes: string; discount: string;
  lines: Array<{ description: string; detail: string; quantity: number; price: string; optional: boolean }>;
};

export async function createProposal(org: string, input: CreateProposalInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { client } = await requireMember(org, true);
    const name = clip(input.name, 200);
    const valid = day(input.validUntil);
    if (!name) return { ok: false, message: 'Enter who the proposal is for.' };
    if (!valid) return { ok: false, message: 'Choose a valid-until date.' };
    if (!DIVISIONS.includes(input.division)) return { ok: false, message: 'Choose a business.' };
    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 60) return { ok: false, message: 'Add between 1 and 60 lines.' };
    const lines = [];
    for (const l of input.lines) {
      const cents = dollarsToCents(l.price), qty = Number(l.quantity);
      if (!clip(l.description, 300)) return { ok: false, message: 'Every line needs a description.' };
      if (cents === null) return { ok: false, message: 'Every line needs a price above zero.' };
      if (!Number.isFinite(qty) || qty <= 0 || qty >= 100000) return { ok: false, message: 'Every line needs a quantity above zero.' };
      lines.push({ description: clip(l.description, 300), detail: clip(l.detail, 1000), quantity: Math.round(qty * 100) / 100, unit_price_cents: cents, optional: !!l.optional });
    }
    const discount = input.discount.trim() === '' ? 0 : dollarsToCents(input.discount);
    if (discount === null) return { ok: false, message: 'The discount must be an amount above zero, or blank.' };
    const leadId = input.leadId && UUID.test(input.leadId) ? input.leadId : null;
    const { data, error } = await client.rpc('oj_create_proposal', {
      p_org: org, p_customer: { name, email: clip(input.email, 200), address: clip(input.address, 500), lead_id: leadId }, p_division: input.division, p_valid: valid,
      p_payment_terms: clip(input.paymentTerms, 200), p_terms: clip(input.terms, 4000), p_exclusions: clip(input.exclusions, 4000), p_notes: clip(input.notes, 2000),
      p_discount_cents: discount, p_lines: lines,
    });
    if (error || !data) return { ok: false, message: friendly(error?.message) };
    return { ok: true, id: String(data) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not save the proposal.' }; }
}

export async function setProposalStatus(org: string, id: string, status: 'sent' | 'accepted' | 'declined' | 'expired', date: string, note: string): Promise<ActionResult> {
  try {
    const { client } = await requireMember(org, true);
    const when = day(date);
    if (!UUID.test(id) || !when) return { ok: false, message: 'Choose a valid proposal and date.' };
    if (!['sent', 'accepted', 'declined', 'expired'].includes(status)) return { ok: false, message: 'Choose a status.' };
    const { error } = await client.rpc('oj_set_proposal_status', { p_org: org, p_proposal: id, p_status: status, p_date: when, p_note: clip(note, 500) });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not change the status.' }; }
}

export async function deleteDraftProposal(org: string, id: string): Promise<ActionResult> {
  try {
    const { client } = await requireMember(org, true);
    if (!UUID.test(id)) return { ok: false, message: 'Choose a valid proposal.' };
    const { error } = await client.rpc('oj_delete_draft_proposal', { p_org: org, p_proposal: id });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not delete the draft.' }; }
}

/**
 * Makes a private link a customer can open, with no account, to read and sign a SENT proposal. The random token is made here; only its SHA-256 hash is
 * stored (docs/db-change-proposals/RUN-ME-2026-10-28-portal-esign.sql), so the link exists only in what this returns. The link works for 30 days or until
 * the proposal's valid-through date, whichever is first. Anyone who has it can read and sign that one proposal, so it is shared like a password.
 */
export async function sharePortalLink(org: string, proposalId: string): Promise<ActionResult<{ path: string }>> {
  try {
    const { client } = await requireMember(org, true);
    if (!UUID.test(proposalId)) return { ok: false, message: 'Choose a valid proposal.' };
    const token = randomBytes(32).toString('base64url');
    const digest = createHash('sha256').update(token).digest('hex');
    const { error } = await client.rpc('oj_create_portal_link', { p_org: org, p_proposal: proposalId, p_digest: digest, p_days: 30 });
    if (error) return { ok: false, message: isMissingTable(error) || /function .* does not exist|schema cache/i.test(error.message) ? 'Sharing links is not switched on yet. A founder needs to run the portal SQL.' : friendly(error.message) };
    return { ok: true, path: `/p/${token}` };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not create the link.' }; }
}

/** Stop sharing: every link to this proposal stops working at once. Sharing again makes a new one. */
export async function stopSharingProposal(org: string, proposalId: string): Promise<ActionResult<{ closed: number }>> {
  try {
    const { client } = await requireMember(org, true);
    if (!UUID.test(proposalId)) return { ok: false, message: 'Choose a valid proposal.' };
    const { data, error } = await client.rpc('oj_revoke_proposal_links', { p_org: org, p_proposal: proposalId });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true, closed: Number(data ?? 0) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not stop sharing.' }; }
}

export type ProposalForBooking = { company: string; address: string; service: string; total: number; number: string };

/** What the commercial booking dialog needs from an accepted proposal. Only the proposal's id travels in the URL. */
export async function loadProposalForBooking(org: string, id: string): Promise<ActionResult<{ proposal: ProposalForBooking }>> {
  try {
    const { client } = await requireMember(org, true);
    if (!UUID.test(id)) return { ok: false, message: 'That proposal no longer exists.' };
    const { data: p } = await client.from('oj_proposals').select('id,number,customer_name,site_address,total_cents,status').eq('organization_id', org).eq('id', id).maybeSingle();
    if (!p) return { ok: false, message: 'That proposal no longer exists.' };
    if (p.status !== 'accepted') return { ok: false, message: 'Only an accepted proposal can be scheduled.' };
    const { data: line } = await client.from('oj_proposal_lines').select('description').eq('organization_id', org).eq('proposal_id', id).eq('optional', false).order('position').limit(1).maybeSingle();
    return { ok: true, proposal: { company: String(p.customer_name), address: String(p.site_address ?? ''), service: String(line?.description ?? ''), total: Number(p.total_cents) / 100, number: String(p.number) } };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not load the proposal.' }; }
}
