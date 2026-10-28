import type { Metadata } from 'next';
import { isConfigured } from '@/lib/supabase';
import { supabasePublic } from '@/lib/supabase-public';
import { PrintButton } from '../../workspace/invoices/[id]/PrintButton';
import { ProposalDecision } from './ProposalDecision';

export const dynamic = 'force-dynamic';
// A private link: keep it out of search engines and out of the Referer header sent to anything it links to.
export const metadata: Metadata = { title: 'Proposal', robots: { index: false, follow: false }, referrer: 'no-referrer' };

type Line = { id: string; description: string; detail: string; quantity: number; unit_price_cents: number; amount_cents: number; optional: boolean };
type Proposal = {
  number: string; customer_name: string; site_address: string; status: string; valid_until: string; payment_terms: string; terms: string; exclusions: string; notes: string;
  subtotal_cents: number; discount_cents: number; total_cents: number; lines: Line[]; expired: boolean;
  decision: { decision: 'accepted' | 'declined'; signer_name: string; at: string; agreed_total_cents: number } | null;
};

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const when = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const styles = `
  .pp { background: #eef1f6; min-height: 100dvh; padding: 20px 12px 48px; color: #111; font: 15px/1.55 system-ui, sans-serif; }
  .pp-sheet { max-width: 760px; margin: 0 auto; background: #fff; padding: 36px; border-radius: 8px; box-shadow: 0 8px 30px rgba(20, 30, 50, .08); }
  .pp h1 { font-size: 26px; margin: 0; letter-spacing: -0.02em; } .pp h2 { font-size: 16px; margin: 26px 0 4px; }
  .pp .row { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
  .pp table { width: 100%; border-collapse: collapse; margin-top: 10px; } .pp th, .pp td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #d9dee8; vertical-align: top; }
  .pp .num { text-align: right; font-variant-numeric: tabular-nums; } .pp .muted { color: #5a6578; font-size: 13px; } .pp .total { font-size: 19px; font-weight: 700; }
  .pp .copy { white-space: pre-wrap; } .pp-actions { max-width: 760px; margin: 0 auto 10px; display: flex; justify-content: flex-end; }
  .pp .decision { margin-top: 30px; padding: 20px; border: 2px solid #111; border-radius: 10px; display: grid; gap: 14px; }
  .pp .decision label { display: grid; gap: 6px; font-weight: 600; } .pp .decision input[type=text], .pp .decision input:not([type]), .pp .decision input[type=search] { font: inherit; padding: 12px; border: 1px solid #99a3b5; border-radius: 8px; }
  .pp .decision .check { display: flex; gap: 10px; align-items: flex-start; font-weight: 500; } .pp .decision .check input { width: 22px; height: 22px; margin-top: 2px; }
  .pp .decision fieldset { border: 1px solid #d9dee8; border-radius: 8px; padding: 10px 14px; display: grid; gap: 8px; }
  .pp .decision .agreed { margin: 0; font-size: 17px; } .pp .accept { font: inherit; font-weight: 700; padding: 16px; border: 0; border-radius: 10px; background: #111; color: #fff; cursor: pointer; }
  .pp .accept:disabled { opacity: .4; cursor: not-allowed; } .pp .decline { font: inherit; padding: 10px 14px; border: 1px solid #99a3b5; border-radius: 8px; background: #fff; cursor: pointer; }
  .pp .decision-error { color: #b00020; margin: 0; } .pp .decision-done { margin-top: 30px; padding: 20px; border-radius: 10px; background: #eaf6ee; }
  .pp .decided { margin-top: 30px; padding: 16px 20px; border-radius: 10px; background: #f3f5f9; }
  @media (max-width: 600px) { .pp-sheet { padding: 22px; } } @media print { .pp { background: #fff; padding: 0; } .pp-actions, .pp .decision { display: none; } .pp-sheet { box-shadow: none; padding: 0; } }
`;

/** The page a customer opens from the private link: their proposal, and a way to accept or decline it. No account, no navigation, nothing else from the workspace. */
export default async function PublicProposal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let p: Proposal | null = null;
  if (isConfigured() && token.length >= 32 && token.length <= 200) {
    try { const { data } = await supabasePublic().rpc('oj_portal_proposal', { p_token: token }); p = (data as Proposal | null) ?? null; } catch { p = null; }
  }
  if (!p) return <main className="pp"><style>{styles}</style><article className="pp-sheet"><h1>This link is no longer valid</h1><p>It may have expired or been replaced. Please contact OJ Exterior Care for a new one.</p><p className="muted">262-515-3083 · ojexteriorcare.com</p></article></main>;

  const priced = p.lines.filter(l => !l.optional), optional = p.lines.filter(l => l.optional);
  const row = (l: Line) => <tr key={l.id}><td>{l.description}{l.detail ? <><br /><span className="muted">{l.detail}</span></> : null}</td><td className="num">{Number(l.quantity)}</td><td className="num">{money(l.unit_price_cents)}</td><td className="num">{money(l.amount_cents)}</td></tr>;
  const open = p.status === 'sent' && !p.expired && !p.decision;
  return (
    <main className="pp">
      <style>{styles}</style>
      <div className="pp-actions"><PrintButton /></div>
      <article className="pp-sheet">
        <div className="row">
          <div><h1>Proposal {p.number}</h1><p className="muted">Valid through {when(p.valid_until)}</p></div>
          <div className="num"><strong>OJ Exterior Care</strong><br />Operated by OJ Holdings LLC<br /><span className="muted">262-515-3083 · ojexteriorcare.com</span></div>
        </div>
        <div style={{ marginTop: 22 }}><span className="muted">Prepared for</span><br /><strong>{p.customer_name}</strong>{p.site_address ? <><br />{p.site_address}</> : null}</div>
        <h2>Scope and pricing</h2>
        <table><thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr></thead><tbody>{priced.map(row)}</tbody></table>
        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}><div className="num">
          <div>Subtotal {money(p.subtotal_cents)}</div>{p.discount_cents > 0 && <div>Package discount −{money(p.discount_cents)}</div>}<div className="total">Total {money(p.total_cents)}</div>
        </div></div>
        {optional.length > 0 && <><h2>Optional services</h2><p className="muted">Not in the total above. Choose any you want when you accept.</p><table><tbody>{optional.map(row)}</tbody></table></>}
        {p.payment_terms ? <><h2>Payment</h2><p>{p.payment_terms}</p></> : null}
        {p.terms ? <><h2>Terms</h2><p className="copy">{p.terms}</p></> : null}
        {p.exclusions ? <><h2>Exclusions</h2><p className="copy">{p.exclusions}</p></> : null}
        {p.notes ? <><h2>Notes</h2><p className="copy">{p.notes}</p></> : null}

        {p.decision && <div className="decided" role="status"><b>{p.decision.decision === 'accepted' ? `Accepted by ${p.decision.signer_name}` : `Declined by ${p.decision.signer_name}`}</b> on {when(p.decision.at)}{p.decision.decision === 'accepted' ? `, for ${money(p.decision.agreed_total_cents)}.` : '.'}</div>}
        {!p.decision && p.expired && <div className="decided" role="status">This proposal expired on {when(p.valid_until)}. Please contact us for a new one.</div>}
        {open && <ProposalDecision token={token} baseCents={p.total_cents} optional={optional.map(o => ({ id: o.id, description: o.description, amount_cents: o.amount_cents }))} />}
      </article>
    </main>
  );
}
