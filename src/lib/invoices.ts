/** Pure helpers for the invoice screens. Money is whole cents everywhere except what a person types. */

export type InvoiceStatus = 'open' | 'paid' | 'void';
export type Invoice = {
  id: string; number: string; division: string; customer_name: string; customer_email: string | null; bill_to: string;
  status: InvoiceStatus; issue_date: string; due_date: string; terms: string; notes: string;
  subtotal_cents: number; tax_cents: number; total_cents: number; paid_cents: number; created_at: string;
};
export type InvoiceLine = { id: string; position: number; description: string; quantity: number; unit_price_cents: number; amount_cents: number };
export type Payment = { id: string; amount_cents: number; method: string; received_on: string; reference: string };

export const paymentMethods = [['ach', 'Bank transfer (ACH)'], ['check', 'Check'], ['card', 'Card'], ['cash', 'Cash'], ['zelle', 'Zelle'], ['venmo', 'Venmo'], ['other', 'Other']] as const;
export const termOptions = [['0', 'Due on receipt'], ['15', 'Net 15'], ['30', 'Net 30'], ['45', 'Net 45']] as const;

/** What a person types as dollars (for example "1,230.50") to whole cents; null when it is not a valid positive amount. */
export function dollarsToCents(raw: string | number): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n >= 100_000_000) return null;
  return Math.round(n * 100);
}

export const lineAmountCents = (quantity: number, unitPriceCents: number) => Math.round(quantity * unitPriceCents);

export function draftTotals(lines: Array<{ quantity: number; unit_price_cents: number }>) {
  const subtotal = lines.reduce((sum, l) => sum + lineAmountCents(l.quantity, l.unit_price_cents), 0);
  return { subtotal_cents: subtotal, tax_cents: 0, total_cents: subtotal };
}

const dayNumber = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000); };
export const addDays = (iso: string, days: number) => new Date((dayNumber(iso) + days) * 86_400_000).toISOString().slice(0, 10);
export const dueFromTerms = (issue: string, netDays: number) => addDays(issue, netDays);
export const balanceCents = (inv: Pick<Invoice, 'total_cents' | 'paid_cents' | 'status'>) => inv.status === 'open' ? inv.total_cents - inv.paid_cents : 0;
export const daysOverdue = (inv: Pick<Invoice, 'due_date' | 'status'>, today: string) => inv.status === 'open' ? Math.max(0, dayNumber(today) - dayNumber(inv.due_date)) : 0;

export function summariseInvoices(invoices: Invoice[], today: string) {
  const open = invoices.filter(i => i.status === 'open');
  const month = today.slice(0, 7);
  const overdue = open.filter(i => daysOverdue(i, today) > 0);
  return {
    openCount: open.length,
    openCents: open.reduce((s, i) => s + balanceCents(i), 0),
    overdueCount: overdue.length,
    overdueCents: overdue.reduce((s, i) => s + balanceCents(i), 0),
    issuedThisMonthCents: invoices.filter(i => i.status !== 'void' && i.issue_date.startsWith(month)).reduce((s, i) => s + i.total_cents, 0),
  };
}

/** Open invoices first, then paid, then void; newest first within each. */
export function sortInvoices(invoices: Invoice[]): Invoice[] {
  const rank = { open: 0, paid: 1, void: 2 } as const;
  return [...invoices].sort((a, b) => rank[a.status] - rank[b.status] || b.issue_date.localeCompare(a.issue_date) || b.number.localeCompare(a.number));
}

/** True when a database error means the money tables are simply not installed yet (as opposed to a real failure). */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache|could not find the table/i.test(error.message ?? '');
}
