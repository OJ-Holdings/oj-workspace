'use server';

import { requireMember } from '@/lib/supabase';
import { dollarsToCents, dueFromTerms, isMissingTable, paymentMethods, type Invoice } from '@/lib/invoices';

// Invoices and payments are written only through the database functions (oj_issue_invoice, oj_record_payment, oj_void_invoice, oj_seed_chart)
// from docs/db-change-proposals/money-core. Until an owner has applied that SQL these actions report 'not-set-up' and change nothing.

export type AccountOption = { id: string; code: string; name: string };
export type InvoicesLoad =
  | { ok: true; invoices: Invoice[]; incomeAccounts: AccountOption[]; chartReady: boolean }
  | { ok: false; reason: 'not-set-up' | 'no-access' | 'failed' };
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; message: string };

const DIVISIONS = ['exterior', 'solutions', 'essentials', 'content', 'shared'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const friendly = (message: string | undefined) => (message ?? 'That did not go through.').replace(/^.*?(ERROR:\s*)/i, '').slice(0, 240);

type Row = Record<string, unknown>;
const toInvoice = (r: Row): Invoice => ({
  id: String(r.id), number: String(r.number), division: String(r.division), customer_name: String(r.customer_name), customer_email: (r.customer_email as string | null) ?? null,
  bill_to: String(r.bill_to ?? ''), status: r.status as Invoice['status'], issue_date: String(r.issue_date), due_date: String(r.due_date), terms: String(r.terms ?? ''), notes: String(r.notes ?? ''),
  subtotal_cents: Number(r.subtotal_cents), tax_cents: Number(r.tax_cents), total_cents: Number(r.total_cents), paid_cents: Number(r.paid_cents), created_at: String(r.created_at),
});

export async function loadInvoices(org: string): Promise<InvoicesLoad> {
  let ctx;
  try { ctx = await requireMember(org); } catch { return { ok: false, reason: 'no-access' }; }
  const { client } = ctx;
  const inv = await client.from('oj_invoices').select('id,number,division,customer_name,customer_email,bill_to,status,issue_date,due_date,terms,notes,subtotal_cents,tax_cents,total_cents,paid_cents,created_at').eq('organization_id', org).order('issue_date', { ascending: false }).limit(300);
  if (inv.error) return { ok: false, reason: isMissingTable(inv.error) ? 'not-set-up' : 'failed' };
  const accounts = await client.from('oj_accounts').select('id,code,name').eq('organization_id', org).eq('type', 'income').eq('active', true).order('code');
  if (accounts.error) return { ok: false, reason: isMissingTable(accounts.error) ? 'not-set-up' : 'failed' };
  return { ok: true, invoices: (inv.data ?? []).map(toInvoice), incomeAccounts: (accounts.data ?? []) as AccountOption[], chartReady: (accounts.data ?? []).length > 0 };
}

export async function seedChart(org: string): Promise<ActionResult<{ count: number }>> {
  try {
    const { client, member } = await requireMember(org, true);
    if (member.role !== 'owner') return { ok: false, message: 'Only an owner can set up the chart of accounts.' };
    const { data, error } = await client.rpc('oj_seed_chart', { p_org: org });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true, count: Number(data) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not set up the chart.' }; }
}

export type IssueInput = {
  key: string; name: string; email: string; billTo: string; leadId?: string | null; division: string; issueDate: string; netDays: number; notes: string;
  lines: Array<{ description: string; quantity: number; price: string; incomeAccountId: string }>;
};

export async function issueInvoice(org: string, input: IssueInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { client } = await requireMember(org, true);
    const name = clip(input.name, 200);
    const issue = day(input.issueDate);
    if (!name) return { ok: false, message: 'Enter who the invoice is for.' };
    if (!issue) return { ok: false, message: 'Choose a valid issue date.' };
    if (!DIVISIONS.includes(input.division)) return { ok: false, message: 'Choose a business.' };
    if (![0, 15, 30, 45].includes(input.netDays)) return { ok: false, message: 'Choose payment terms.' };
    if (!clip(input.key, 200)) return { ok: false, message: 'Missing request key. Reload and try again.' };
    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 40) return { ok: false, message: 'Add between 1 and 40 lines.' };
    const lines = [];
    for (const l of input.lines) {
      const cents = dollarsToCents(l.price);
      const qty = Number(l.quantity);
      if (!clip(l.description, 300)) return { ok: false, message: 'Every line needs a description.' };
      if (cents === null) return { ok: false, message: 'Every line needs a price above zero.' };
      if (!Number.isFinite(qty) || qty <= 0 || qty >= 100000) return { ok: false, message: 'Every line needs a quantity above zero.' };
      if (!UUID.test(l.incomeAccountId)) return { ok: false, message: 'Choose an income account for every line.' };
      lines.push({ description: clip(l.description, 300), quantity: Math.round(qty * 100) / 100, unit_price_cents: cents, income_account_id: l.incomeAccountId });
    }
    const leadId = input.leadId && UUID.test(input.leadId) ? input.leadId : null;
    const { data, error } = await client.rpc('oj_issue_invoice', {
      p_org: org, p_key: clip(input.key, 200), p_customer: { name, email: clip(input.email, 200), bill_to: clip(input.billTo, 500), lead_id: leadId },
      p_division: input.division, p_issue: issue, p_due: dueFromTerms(issue, input.netDays), p_terms: input.netDays === 0 ? 'Due on receipt' : `Net ${input.netDays}`,
      p_notes: clip(input.notes, 2000), p_lines: lines,
    });
    if (error || !data) return { ok: false, message: friendly(error?.message) };
    return { ok: true, id: String(data) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not issue the invoice.' }; }
}

export async function recordPayment(org: string, input: { invoiceId: string; amount: string; method: string; receivedOn: string; reference: string; key: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const { client } = await requireMember(org, true);
    const cents = dollarsToCents(input.amount);
    const received = day(input.receivedOn);
    if (!UUID.test(input.invoiceId)) return { ok: false, message: 'Choose an invoice.' };
    if (cents === null) return { ok: false, message: 'Enter a payment amount above zero.' };
    if (!received) return { ok: false, message: 'Choose the date the money arrived.' };
    if (!paymentMethods.some(([m]) => m === input.method)) return { ok: false, message: 'Choose how it was paid.' };
    if (!clip(input.key, 200)) return { ok: false, message: 'Missing request key. Reload and try again.' };
    const { data, error } = await client.rpc('oj_record_payment', { p_org: org, p_invoice: input.invoiceId, p_amount_cents: cents, p_method: input.method, p_received: received, p_reference: clip(input.reference, 200), p_key: clip(input.key, 200) });
    if (error || !data) return { ok: false, message: friendly(error?.message) };
    return { ok: true, id: String(data) };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not record the payment.' }; }
}

export async function voidInvoice(org: string, invoiceId: string, date: string, reason: string): Promise<ActionResult> {
  try {
    const { client } = await requireMember(org, true);
    const when = day(date);
    if (!UUID.test(invoiceId) || !when) return { ok: false, message: 'Choose a valid invoice and date.' };
    const { error } = await client.rpc('oj_void_invoice', { p_org: org, p_invoice: invoiceId, p_date: when, p_reason: clip(reason, 200), p_key: `void-${invoiceId}` });
    if (error) return { ok: false, message: friendly(error.message) };
    return { ok: true };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Could not void the invoice.' }; }
}

export type JobForInvoice = { leadId: string; name: string; address: string; service: string; amount: number | null };

/** The few facts a job needs to start an invoice: who, where, what, and the amount (what was recorded as paid, else the quote). Only the job's id travels in the URL. */
export async function leadForInvoice(org: string, leadId: string): Promise<ActionResult<{ lead: JobForInvoice }>> {
  try {
    if (!UUID.test(leadId)) return { ok: false, message: 'That job no longer exists.' };
    const { client } = await requireMember(org, true);
    const { data } = await client.from('leads').select('id,name,address,service_requested,quote_amount,job_revenue').eq('id', leadId).maybeSingle();
    if (!data) return { ok: false, message: 'That job no longer exists.' };
    const amount = data.job_revenue ?? data.quote_amount ?? null;
    return { ok: true, lead: { leadId: data.id as string, name: (data.name as string) ?? '', address: (data.address as string) ?? '', service: (data.service_requested as string) ?? '', amount: amount === null ? null : Number(amount) } };
  } catch { return { ok: false, message: 'Only workspace members can start an invoice.' }; }
}
