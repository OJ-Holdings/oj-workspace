import { notFound, redirect } from 'next/navigation';
import { isConfigured, supabaseServer } from '@/lib/supabase';
import { PrintButton } from '../../invoices/[id]/PrintButton';

export const dynamic = 'force-dynamic';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const when = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A clean proposal to print or save as PDF, with an acceptance block to sign. Row-level security decides who can read it: owners and members of the proposal's company. */
export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  if (!isConfigured()) redirect('/login');
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: p } = await client.from('oj_proposals').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const { data: lines } = await client.from('oj_proposal_lines').select('position,description,detail,quantity,unit_price_cents,amount_cents,optional').eq('proposal_id', id).order('position');
  const priced = (lines ?? []).filter(l => !l.optional), optional = (lines ?? []).filter(l => l.optional);
  const row = (l: { description: string; detail: string | null; quantity: unknown; unit_price_cents: unknown; amount_cents: unknown }, i: number) => (
    <tr key={i}><td>{l.description}{l.detail ? <><br /><span className="muted">{l.detail}</span></> : null}</td><td className="num">{Number(l.quantity)}</td><td className="num">{money(Number(l.unit_price_cents))}</td><td className="num">{money(Number(l.amount_cents))}</td></tr>
  );
  return (
    <main className="invoice-sheet-page">
      <style>{`
        .invoice-sheet-page { background: #e8ecf3; min-height: 100dvh; padding: 24px 12px; color: #111; }
        .invoice-sheet { max-width: 820px; margin: 0 auto; background: #fff; color: #111; padding: 48px; border-radius: 6px; font: 14px/1.5 system-ui, sans-serif; }
        .invoice-sheet h1 { font-size: 28px; margin: 0; letter-spacing: -0.02em; }
        .invoice-sheet h2 { font-size: 15px; margin: 28px 0 4px; }
        .invoice-sheet .row { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .invoice-sheet table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .invoice-sheet th, .invoice-sheet td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #d9dee8; vertical-align: top; }
        .invoice-sheet .num { text-align: right; font-variant-numeric: tabular-nums; }
        .invoice-sheet .muted { color: #5a6578; font-size: 12px; }
        .invoice-sheet .total { font-size: 18px; font-weight: 700; }
        .invoice-sheet .copy { white-space: pre-wrap; }
        .invoice-sheet .sign { margin-top: 40px; display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 24px; }
        .invoice-sheet .sign div { border-top: 1px solid #111; padding-top: 4px; font-size: 12px; color: #5a6578; }
        .invoice-actions { max-width: 820px; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
        @media print { .invoice-sheet-page { background: #fff; padding: 0; } .invoice-actions { display: none; } .invoice-sheet { padding: 0; border-radius: 0; } }
      `}</style>
      <div className="invoice-actions"><PrintButton /></div>
      <article className="invoice-sheet">
        <div className="row">
          <div>
            <h1>Proposal {p.number}</h1>
            <p className="muted">Prepared {when(p.created_at)} · Valid through {when(p.valid_until)}</p>
          </div>
          <div className="num">
            <strong>OJ Exterior Care</strong><br />Operated by OJ Holdings LLC<br />
            <span className="muted">262-515-3083 · ojexteriorcare.com</span>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <span className="muted">Prepared for</span><br /><strong>{p.customer_name}</strong>
          {p.site_address ? <><br />{p.site_address}</> : null}{p.customer_email ? <><br />{p.customer_email}</> : null}
        </div>
        <h2>Scope and pricing</h2>
        <table>
          <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead>
          <tbody>{priced.map(row)}</tbody>
        </table>
        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <div className="num">
            <div>Subtotal {money(Number(p.subtotal_cents))}</div>
            {Number(p.discount_cents) > 0 && <div>Package discount −{money(Number(p.discount_cents))}</div>}
            <div className="total">Total {money(Number(p.total_cents))}</div>
          </div>
        </div>
        {optional.length > 0 && <>
          <h2>Optional services</h2>
          <p className="muted">Not included in the total above. Add any of these when you accept.</p>
          <table><tbody>{optional.map(row)}</tbody></table>
        </>}
        {p.payment_terms ? <><h2>Payment</h2><p>{p.payment_terms}</p></> : null}
        {p.terms ? <><h2>Terms</h2><p className="copy">{p.terms}</p></> : null}
        {p.exclusions ? <><h2>Exclusions</h2><p className="copy">{p.exclusions}</p></> : null}
        {p.notes ? <><h2>Notes</h2><p className="copy">{p.notes}</p></> : null}
        <h2>Acceptance</h2>
        <p className="muted">By signing, {p.customer_name} accepts this proposal for the total above on the terms stated.</p>
        <div className="sign"><div>Name and title</div><div>Signature</div><div>Date</div></div>
      </article>
    </main>
  );
}
