import { notFound, redirect } from 'next/navigation';
import { isConfigured, supabaseServer } from '@/lib/supabase';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const when = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A clean invoice page to print or save as PDF. Row-level security decides who can read it: only members of the invoice's company. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  if (!isConfigured()) redirect('/login');
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: inv } = await client.from('oj_invoices').select('*').eq('id', id).maybeSingle();
  if (!inv) notFound();
  const [lines, payments] = await Promise.all([
    client.from('oj_invoice_lines').select('position,description,quantity,unit_price_cents,amount_cents').eq('invoice_id', id).order('position'),
    client.from('oj_payments').select('amount_cents,method,received_on,reference').eq('invoice_id', id).order('received_on'),
  ]);
  const total = Number(inv.total_cents), paid = Number(inv.paid_cents);
  return (
    <main className="invoice-sheet-page">
      <style>{`
        .invoice-sheet-page { background: #e8ecf3; min-height: 100dvh; padding: 24px 12px; color: #111; }
        .invoice-sheet { max-width: 820px; margin: 0 auto; background: #fff; color: #111; padding: 48px; border-radius: 6px; font: 14px/1.5 system-ui, sans-serif; }
        .invoice-sheet h1 { font-size: 28px; margin: 0; letter-spacing: -0.02em; }
        .invoice-sheet .row { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .invoice-sheet table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        .invoice-sheet th, .invoice-sheet td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #d9dee8; }
        .invoice-sheet .num { text-align: right; font-variant-numeric: tabular-nums; }
        .invoice-sheet .muted { color: #5a6578; font-size: 12px; }
        .invoice-sheet .total { font-size: 18px; font-weight: 700; }
        .invoice-sheet .void { color: #b00020; font-weight: 700; letter-spacing: .08em; }
        .invoice-actions { max-width: 820px; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
        @media print { .invoice-sheet-page { background: #fff; padding: 0; } .invoice-actions { display: none; } .invoice-sheet { padding: 0; border-radius: 0; } }
      `}</style>
      <div className="invoice-actions"><PrintButton /></div>
      <article className="invoice-sheet">
        <div className="row">
          <div>
            <h1>Invoice {inv.number}</h1>
            {inv.status === 'void' && <p className="void">VOID</p>}
            {inv.status === 'paid' && <p className="muted">PAID IN FULL</p>}
          </div>
          <div className="num">
            <strong>OJ Exterior Care</strong><br />Operated by OJ Holdings LLC<br />
            <span className="muted">262-515-3083 · ojexteriorcare.com</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 28 }}>
          <div><span className="muted">Bill to</span><br /><strong>{inv.customer_name}</strong><br />{String(inv.bill_to).split('\n').map((l: string, i: number) => <span key={i}>{l}<br /></span>)}{inv.customer_email}</div>
          <div className="num"><span className="muted">Issued</span> {when(inv.issue_date)}<br /><span className="muted">Due</span> {when(inv.due_date)}<br /><span className="muted">Terms</span> {inv.terms || '-'}</div>
        </div>
        <table>
          <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
          <tbody>{(lines.data ?? []).map((l, i) => <tr key={i}><td>{l.description}</td><td className="num">{Number(l.quantity)}</td><td className="num">{money(Number(l.unit_price_cents))}</td><td className="num">{money(Number(l.amount_cents))}</td></tr>)}</tbody>
        </table>
        <div className="row" style={{ marginTop: 16 }}>
          <div className="muted" style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{inv.notes}</div>
          <div className="num">
            <div>Subtotal {money(Number(inv.subtotal_cents))}</div>
            {Number(inv.tax_cents) > 0 && <div>Tax {money(Number(inv.tax_cents))}</div>}
            <div className="total">Total {money(total)}</div>
            {paid > 0 && <div>Paid {money(paid)}</div>}
            {inv.status === 'open' && <div className="total">Balance due {money(total - paid)}</div>}
          </div>
        </div>
        {(payments.data ?? []).length > 0 && <>
          <p className="muted" style={{ marginTop: 24 }}>Payments received</p>
          <table><tbody>{(payments.data ?? []).map((p, i) => <tr key={i}><td>{when(p.received_on)}</td><td>{p.method}{p.reference ? ` · ${p.reference}` : ''}</td><td className="num">{money(Number(p.amount_cents))}</td></tr>)}</tbody></table>
        </>}
      </article>
    </main>
  );
}
