'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Printer } from 'lucide-react';
import { issueInvoice, loadInvoices, recordPayment, seedChart, voidInvoice, type AccountOption, type InvoicesLoad } from '@/app/workspace/invoice-actions';
import { balanceCents, daysOverdue, dollarsToCents, draftTotals, paymentMethods, sortInvoices, summariseInvoices, termOptions, type Invoice } from '@/lib/invoices';
import { businessDay } from '@/lib/reporting';
import { dollars } from '@/lib/metrics';
import { ventureList, ventures } from '@/lib/ventures';
import { Modal } from './ExteriorManage';

type Props = { org: string; mode: 'preview' | 'live'; readOnly: boolean; owner: boolean; base: string };
type Line = { description: string; quantity: string; price: string; incomeAccountId: string };

const cents = (n: number) => dollars(n / 100);
const DEFAULT_ACCOUNT: Record<string, string> = { exterior: '4000', solutions: '4110', essentials: '4200' };
const when = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

/** Invoices: issue, take payments (bank transfer, check, card, cash), void. Every invoice posts to the books through database functions. */
export function InvoicesView({ org, mode, readOnly, owner, base }: Props) {
  const [load, setLoad] = useState<InvoicesLoad | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const today = useMemo(() => businessDay(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10), []);

  const refresh = useCallback(async () => { setLoad(await loadInvoices(org)); }, [org]);
  useEffect(() => { if (mode === 'live') void refresh(); }, [mode, refresh]);

  if (mode === 'preview') return <section className="panel"><p className="quiet">Invoicing works in your live workspace. The sample workspace never creates invoices or moves money.</p></section>;
  if (!load) return <div className="loading" aria-busy="true" />;
  if (!load.ok) {
    return (
      <section className="panel" role="status">
        <h2>{load.reason === 'not-set-up' ? 'Invoicing is not switched on yet' : load.reason === 'no-access' ? 'Members only' : 'Invoices did not load'}</h2>
        <p className="quiet">{load.reason === 'not-set-up'
          ? 'It needs one database update (the money tables). Once an owner has run it, this page works with no other change.'
          : load.reason === 'no-access' ? 'Ask a founder for member access.' : 'Try again in a moment.'}</p>
        {load.reason === 'failed' && <button className="secondary" onClick={() => void refresh()}>Try again</button>}
      </section>
    );
  }

  const { invoices, incomeAccounts, chartReady } = load;
  const sorted = sortInvoices(invoices);
  const sum = summariseInvoices(invoices, today);
  const canWrite = !readOnly;
  const run = async (work: () => Promise<{ ok: boolean; message?: string }>, success: string): Promise<boolean> => {
    setBusy(true); setNotice('');
    try {
      const r = await work();
      if (!r.ok) { setNotice(r.message ?? 'That did not go through.'); return false; }
      setNotice(success); await refresh(); return true;
    } catch { setNotice('That did not go through. Check your connection and try again.'); return false; }
    finally { setBusy(false); }
  };

  return (
    <>
      <p className="notice" role="status" aria-live="polite">{notice}</p>
      <div className="kpis">
        <div><span>Owed to you</span><strong>{cents(sum.openCents)}</strong><small className="quiet">{sum.openCount} open invoice{sum.openCount === 1 ? '' : 's'}</small></div>
        <div><span>Overdue</span><strong className={sum.overdueCents > 0 ? 'neg' : ''}>{cents(sum.overdueCents)}</strong><small className="quiet">{sum.overdueCount} past due</small></div>
        <div><span>Invoiced this month</span><strong>{cents(sum.issuedThisMonthCents)}</strong><small className="quiet">Not the same as paid</small></div>
      </div>

      {!chartReady && (
        <section className="panel">
          <h2>Set up your books</h2>
          <p className="quiet">Invoices post to a chart of accounts (income, receivables, cash). An owner starts it once with a standard small-business set for OJ Holdings.</p>
          {owner && canWrite ? <button className="primary" disabled={busy} onClick={() => void run(() => seedChart(org), 'Chart of accounts created.')}>Set up chart of accounts</button> : <p className="quiet">An owner needs to do this step.</p>}
        </section>
      )}

      <section className="panel">
        <header className="panel-head">
          <h2>Invoices</h2>
          {canWrite && chartReady && <button className="primary" onClick={() => setCreating(true)}><Plus size={15} aria-hidden="true" />New invoice</button>}
        </header>
        {sorted.length === 0 ? <div className="empty"><p><b>No invoices yet.</b> {chartReady ? 'Create the first one.' : 'Set up the chart of accounts first.'}</p></div> : (
          <div className="tablewrap">
            <table className="table">
              <caption className="sr-only">Invoices</caption>
              <thead><tr><th scope="col">Invoice</th><th scope="col">Customer</th><th scope="col">Issued</th><th scope="col">Due</th><th scope="col" className="num">Total</th><th scope="col" className="num">Balance</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{sorted.map(i => {
                const late = daysOverdue(i, today);
                return (
                  <tr key={i.id}>
                    <th scope="row">{i.number}</th>
                    <td>{i.customer_name}<small className="quiet block">{ventures[i.division as keyof typeof ventures]?.short ?? i.division}</small></td>
                    <td>{when(i.issue_date)}</td>
                    <td>{when(i.due_date)}{late > 0 && <small className="neg block">{late} day{late === 1 ? '' : 's'} late</small>}</td>
                    <td className="num">{cents(i.total_cents)}</td>
                    <td className="num">{cents(balanceCents(i))}</td>
                    <td>{i.status === 'open' ? (i.paid_cents > 0 ? 'Part paid' : 'Open') : i.status === 'paid' ? 'Paid' : 'Void'}</td>
                    <td>
                      <a className="secondary small" href={`${base}/invoices/${i.id}`} target="_blank" rel="noopener"><Printer size={14} aria-hidden="true" /> View</a>
                      {canWrite && i.status === 'open' && <button className="secondary small" onClick={() => setPaying(i)}>Record payment</button>}
                      {canWrite && i.status === 'open' && i.paid_cents === 0 && <button className="secondary small" disabled={busy} onClick={() => { if (window.confirm(`Void ${i.number}? This cancels the invoice and reverses it in the books.`)) void run(() => voidInvoice(org, i.id, today, ''), `${i.number} voided.`); }}>Void</button>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      <NewInvoice open={creating} close={() => setCreating(false)} accounts={incomeAccounts} today={today} busy={busy}
        submit={(input) => run(() => issueInvoice(org, input), 'Invoice created.').then(ok => { if (ok) setCreating(false); return ok; })} />
      <PaymentDialog invoice={paying} close={() => setPaying(null)} today={today} busy={busy}
        submit={(input) => run(() => recordPayment(org, input), 'Payment recorded.').then(ok => { if (ok) setPaying(null); return ok; })} />
    </>
  );
}

function NewInvoice({ open, close, accounts, today, busy, submit }: { open: boolean; close: () => void; accounts: AccountOption[]; today: string; busy: boolean; submit: (input: Parameters<typeof issueInvoice>[1]) => Promise<boolean> }) {
  const defaultAccount = (division: string) => accounts.find(a => a.code === DEFAULT_ACCOUNT[division])?.id ?? accounts[0]?.id ?? '';
  const blank = useCallback((division = 'exterior'): { key: string; name: string; email: string; billTo: string; division: string; netDays: number; issueDate: string; notes: string; lines: Line[] } => (
    { key: newKey(), name: '', email: '', billTo: '', division, netDays: 30, issueDate: today, notes: '', lines: [{ description: '', quantity: '1', price: '', incomeAccountId: defaultAccount(division) }] }), [today, accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank()); }, [open, blank]);
  const parsed = f.lines.map(l => ({ quantity: Number(l.quantity) || 0, unit_price_cents: dollarsToCents(l.price) ?? 0 }));
  const totals = draftTotals(parsed);
  const setLine = (index: number, patch: Partial<Line>) => setF({ ...f, lines: f.lines.map((l, i) => i === index ? { ...l, ...patch } : l) });
  return (
    <Modal title="New invoice" open={open} onClose={close}>
      <form onSubmit={e => { e.preventDefault(); void submit({ key: f.key, name: f.name, email: f.email, billTo: f.billTo, division: f.division, issueDate: f.issueDate, netDays: f.netDays, notes: f.notes, lines: f.lines.map(l => ({ description: l.description, quantity: Number(l.quantity), price: l.price, incomeAccountId: l.incomeAccountId })) }); }}>
        <div className="form-grid">
          <label>Bill to<input required maxLength={200} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Customer or company" /></label>
          <label>Email<input type="email" maxLength={200} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
          <label>Business
            <select value={f.division} onChange={e => setF({ ...f, division: e.target.value, lines: f.lines.map(l => ({ ...l, incomeAccountId: defaultAccount(e.target.value) })) })}>
              {ventureList.filter(v => v.id !== 'content').map(v => <option key={v.id} value={v.id}>{v.short}</option>)}
            </select>
          </label>
          <label>Terms<select value={f.netDays} onChange={e => setF({ ...f, netDays: Number(e.target.value) })}>{termOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Issue date<input type="date" required value={f.issueDate} onChange={e => setF({ ...f, issueDate: e.target.value })} /></label>
        </div>
        <label>Address<textarea rows={2} maxLength={500} value={f.billTo} onChange={e => setF({ ...f, billTo: e.target.value })} /></label>
        <fieldset>
          <legend>Lines</legend>
          {f.lines.map((l, i) => (
            <div className="form-grid" key={i}>
              <label>Description<input required maxLength={300} value={l.description} onChange={e => setLine(i, { description: e.target.value })} placeholder="Window cleaning, 108 panes" /></label>
              <label>Qty<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} /></label>
              <label>Price ($)<input required inputMode="decimal" value={l.price} onChange={e => setLine(i, { price: e.target.value })} placeholder="1,230.00" /></label>
              <label>Income account<select value={l.incomeAccountId} onChange={e => setLine(i, { incomeAccountId: e.target.value })}>{accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select></label>
              {f.lines.length > 1 && <button type="button" className="secondary small" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}>Remove line</button>}
            </div>
          ))}
          <button type="button" className="secondary small" disabled={f.lines.length >= 40} onClick={() => setF({ ...f, lines: [...f.lines, { description: '', quantity: '1', price: '', incomeAccountId: defaultAccount(f.division) }] })}>Add line</button>
        </fieldset>
        <label>Notes and payment instructions<textarea rows={3} maxLength={2000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="How to pay (bank transfer details, check payable to), scope notes" /></label>
        <div className="dialog-actions"><span>Total {cents(totals.total_cents)}. Sales tax is not added.</span><button className="primary" disabled={busy || totals.total_cents <= 0}>{busy ? 'Saving' : 'Create invoice'}</button></div>
      </form>
    </Modal>
  );
}

function PaymentDialog({ invoice, close, today, busy, submit }: { invoice: Invoice | null; close: () => void; today: string; busy: boolean; submit: (input: Parameters<typeof recordPayment>[1]) => Promise<boolean> }) {
  const [f, setF] = useState({ amount: '', method: 'ach', receivedOn: today, reference: '', key: newKey() });
  useEffect(() => { if (invoice) setF({ amount: (balanceCents(invoice) / 100).toFixed(2), method: 'ach', receivedOn: today, reference: '', key: newKey() }); }, [invoice, today]);
  return (
    <Modal title={`Record payment: ${invoice?.number ?? ''}`} open={!!invoice} onClose={close}>
      {invoice && <form onSubmit={e => { e.preventDefault(); void submit({ invoiceId: invoice.id, ...f }); }}>
        <p className="quiet">{invoice.customer_name}. {cents(balanceCents(invoice))} still owed.</p>
        <div className="form-grid">
          <label>Amount ($)<input required inputMode="decimal" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label>How<select value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>{paymentMethods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Date received<input type="date" required value={f.receivedOn} onChange={e => setF({ ...f, receivedOn: e.target.value })} /></label>
          <label>Reference<input maxLength={200} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} placeholder="Check number, confirmation" /></label>
        </div>
        <div className="dialog-actions"><span>Checks go to Undeposited Funds until they are deposited.</span><button className="primary" disabled={busy}>{busy ? 'Saving' : 'Record payment'}</button></div>
      </form>}
    </Modal>
  );
}
