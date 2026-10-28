'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { createProposal, deleteDraftProposal, loadProposals, setProposalStatus, type ProposalsLoad } from '@/app/workspace/proposal-actions';
import { leadForInvoice, type JobForInvoice } from '@/app/workspace/invoice-actions';
import { DEFAULT_EXCLUSIONS, DEFAULT_TERMS, draftTotals, effectiveStatus, followUp, paymentTermOptions, statusLabel, summariseProposals, type DraftLine, type Proposal } from '@/lib/proposals';
import { businessDay } from '@/lib/reporting';
import { dollars } from '@/lib/metrics';
import { ventureList } from '@/lib/ventures';
import { Modal } from './ExteriorManage';

type Props = { org: string; mode: 'preview' | 'live'; readOnly: boolean; base: string };

const cents = (n: number) => dollars(n / 100);
const when = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const plusDays = (key: string, n: number) => { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const blankLine = (): DraftLine => ({ description: '', detail: '', quantity: '1', price: '', optional: false });

/** Proposals: priced quotes for commercial and large jobs. Write one, send it, and track it to a decision, with the day 3, 7 and 14 follow-up steps. */
export function ProposalsView({ org, mode, readOnly, base }: Props) {
  const [load, setLoad] = useState<ProposalsLoad | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<JobForInvoice | null>(null);
  const today = useMemo(() => businessDay(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10), []);

  const refresh = useCallback(async () => { setLoad(await loadProposals(org)); }, [org]);
  useEffect(() => { if (mode === 'live') void refresh(); }, [mode, refresh]);

  // Arriving from a job (?lead=<id>): open the builder with the customer already filled in, once.
  const leadParam = useSearchParams().get('lead');
  const handled = useRef('');
  useEffect(() => {
    if (mode !== 'live' || !leadParam || !load || !load.ok || handled.current === leadParam) return;
    handled.current = leadParam;
    void leadForInvoice(org, leadParam).then(r => {
      if (r.ok) { setPrefill(r.lead); setCreating(true); }
      const url = new URL(window.location.href); url.searchParams.delete('lead'); window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    });
  }, [mode, leadParam, load, org]);

  if (mode === 'preview') return <section className="panel"><p className="quiet">Proposals work in your live workspace. The sample workspace never saves them.</p></section>;
  if (!load) return <div className="loading" aria-busy="true" />;
  if (!load.ok) {
    return (
      <section className="panel" role="status">
        <h2>{load.reason === 'not-set-up' ? 'Proposals are not switched on yet' : load.reason === 'no-access' ? 'Members only' : 'Proposals did not load'}</h2>
        <p className="quiet">{load.reason === 'not-set-up' ? 'It needs one small database update. Once an owner has run it, this page works with no other change.' : load.reason === 'no-access' ? 'Ask a founder for member access.' : 'Try again in a moment.'}</p>
        {load.reason === 'failed' && <button className="secondary" onClick={() => void refresh()}>Try again</button>}
      </section>
    );
  }

  const proposals = load.proposals;
  const sum = summariseProposals(proposals, today);
  const run = async (work: () => Promise<{ ok: boolean; message?: string }>, success: string): Promise<boolean> => {
    setBusy(true); setNotice('');
    try {
      const r = await work();
      if (!r.ok) { setNotice(r.message ?? 'That did not go through.'); return false; }
      setNotice(success); await refresh(); return true;
    } catch { setNotice('That did not go through. Check your connection and try again.'); return false; }
    finally { setBusy(false); }
  };
  const canWrite = !readOnly;

  return <>
    <p className="notice" role="status" aria-live="polite">{notice}</p>
    <div className="kpis">
      <div><span>Out waiting</span><strong>{cents(sum.outCents)}</strong><small className="quiet">{sum.outCount} proposal{sum.outCount === 1 ? '' : 's'}{sum.needNudge ? `, ${sum.needNudge} due a nudge` : ''}</small></div>
      <div><span>Won</span><strong>{cents(sum.wonCents)}</strong><small className="quiet">{sum.wonCount} accepted</small></div>
      <div><span>Drafts</span><strong>{sum.draftCount}</strong><small className="quiet">not sent yet</small></div>
    </div>

    <section className="panel">
      <header className="panel-head"><h2>Proposals</h2>{canWrite && <button className="primary" onClick={() => { setPrefill(null); setCreating(true); }}><Plus size={15} aria-hidden="true" />New proposal</button>}</header>
      {proposals.length === 0 ? <div className="empty"><p><b>No proposals yet.</b> Write the first one.</p></div> : <ul className="proposal-list">
        {proposals.map(p => <ProposalRow key={p.id} p={p} today={today} base={base} busy={busy} canWrite={canWrite}
          send={() => void run(() => setProposalStatus(org, p.id, 'sent', today, ''), `${p.number} marked sent.`)}
          decide={(status, note) => void run(() => setProposalStatus(org, p.id, status, today, note), `${p.number} marked ${status}.`)}
          remove={() => { if (window.confirm(`Delete draft ${p.number}?`)) void run(() => deleteDraftProposal(org, p.id), 'Draft deleted.'); }} />)}
      </ul>}
    </section>

    <NewProposal open={creating} close={() => { setCreating(false); setPrefill(null); }} prefill={prefill} today={today} busy={busy}
      submit={input => run(() => createProposal(org, input), 'Proposal saved as a draft.').then(ok => { if (ok) { setCreating(false); setPrefill(null); } return ok; })} />
  </>;
}

function ProposalRow({ p, today, base, busy, canWrite, send, decide, remove }: { p: Proposal; today: string; base: string; busy: boolean; canWrite: boolean; send: () => void; decide: (s: 'accepted' | 'declined', note: string) => void; remove: () => void }) {
  const status = effectiveStatus(p, today);
  const nudge = followUp(p, today);
  return (
    <li className="proposal-row">
      <div>
        <b>{p.customer_name}</b>
        <span>{p.number} · valid through {when(p.valid_until)}{p.sent_on ? ` · sent ${when(p.sent_on)}` : ''}</span>
        {nudge && <span className={`proposal-nudge${nudge.days >= 7 ? ' is-late' : ''}`}>{nudge.step}</span>}
        {p.decision_note && <span>{p.decision_note}</span>}
      </div>
      <strong>{cents(p.total_cents)}</strong>
      <span className={`proposal-status is-${status}`}>{statusLabel[status]}</span>
      <div className="proposal-actions">
        <a className="secondary small" href={`${base}/proposals/${p.id}`} target="_blank" rel="noopener"><Printer size={14} aria-hidden="true" /> View</a>
        {canWrite && status === 'draft' && <button className="primary small" disabled={busy} onClick={send}>Mark sent</button>}
        {canWrite && status === 'sent' && <button className="primary small" disabled={busy} onClick={() => decide('accepted', '')}>Accepted</button>}
        {canWrite && status === 'sent' && <button className="secondary small" disabled={busy} onClick={() => decide('declined', window.prompt('Why was it declined? (optional)') ?? '')}>Declined</button>}
        {canWrite && status === 'draft' && <button className="icon-button" aria-label={`Delete draft ${p.number}`} disabled={busy} onClick={remove}><Trash2 size={14} aria-hidden="true" /></button>}
      </div>
    </li>
  );
}

function NewProposal({ open, close, prefill, today, busy, submit }: { open: boolean; close: () => void; prefill: JobForInvoice | null; today: string; busy: boolean; submit: (input: Parameters<typeof createProposal>[1]) => Promise<boolean> }) {
  const blank = useCallback(() => ({
    name: prefill?.name ?? '', email: '', address: prefill?.address ?? '', division: 'exterior', validUntil: plusDays(today, 30), paymentTerms: paymentTermOptions[0], discount: '', terms: DEFAULT_TERMS, exclusions: DEFAULT_EXCLUSIONS, notes: '',
    lines: [{ ...blankLine(), description: prefill?.service ?? '', price: prefill?.amount != null ? String(prefill.amount) : '' }] as DraftLine[],
  }), [today, prefill]);
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(blank()); }, [open, blank]);
  const totals = draftTotals(f.lines, f.discount);
  const setLine = (i: number, patch: Partial<DraftLine>) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const ready = totals.problem === null && f.name.trim() !== '';
  return (
    <Modal title="New proposal" open={open} onClose={close}>
      <form onSubmit={e => {
        e.preventDefault();
        void submit({ name: f.name, email: f.email, address: f.address, leadId: prefill?.leadId ?? null, division: f.division, validUntil: f.validUntil, paymentTerms: f.paymentTerms, terms: f.terms, exclusions: f.exclusions, notes: f.notes, discount: f.discount,
          lines: f.lines.filter(l => l.description.trim() || l.price.trim()).map(l => ({ description: l.description, detail: l.detail, quantity: Number(l.quantity), price: l.price, optional: l.optional })) });
      }}>
        <div className="form-grid">
          <label>Prepared for<input required maxLength={200} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Company or customer" /></label>
          <label>Email<input type="email" maxLength={200} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
          <label>Business<select value={f.division} onChange={e => setF({ ...f, division: e.target.value })}>{ventureList.filter(v => v.id !== 'content').map(v => <option key={v.id} value={v.id}>{v.short}</option>)}</select></label>
          <label>Valid through<input type="date" required min={today} value={f.validUntil} onChange={e => setF({ ...f, validUntil: e.target.value })} /></label>
        </div>
        <label>Site address<textarea rows={2} maxLength={500} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></label>
        <fieldset>
          <legend>Lines</legend>
          {f.lines.map((l, i) => (
            <div className="form-grid" key={i}>
              <label>Description<input maxLength={300} value={l.description} onChange={e => setLine(i, { description: e.target.value })} placeholder="Facility A exterior windows, 108 panes" /></label>
              <label>Qty<input type="number" min="0.01" step="0.01" inputMode="decimal" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} /></label>
              <label>Price ($)<input inputMode="decimal" value={l.price} onChange={e => setLine(i, { price: e.target.value })} placeholder="950.00" /></label>
              <label className="check"><input type="checkbox" checked={l.optional} onChange={e => setLine(i, { optional: e.target.checked })} /> Optional add-on</label>
              {f.lines.length > 1 && <button type="button" className="secondary small" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}>Remove line</button>}
            </div>
          ))}
          <button type="button" className="secondary small" disabled={f.lines.length >= 60} onClick={() => setF({ ...f, lines: [...f.lines, blankLine()] })}>Add line</button>
        </fieldset>
        <div className="form-grid">
          <label>Package discount ($, optional)<input inputMode="decimal" value={f.discount} onChange={e => setF({ ...f, discount: e.target.value })} placeholder="150.00" /></label>
          <label>Payment<select value={f.paymentTerms} onChange={e => setF({ ...f, paymentTerms: e.target.value })}>{paymentTermOptions.map(o => <option key={o}>{o}</option>)}</select></label>
        </div>
        <label>Terms<textarea rows={3} maxLength={4000} value={f.terms} onChange={e => setF({ ...f, terms: e.target.value })} /></label>
        <label>Exclusions<textarea rows={3} maxLength={4000} value={f.exclusions} onChange={e => setF({ ...f, exclusions: e.target.value })} /></label>
        <label>Notes<textarea rows={2} maxLength={2000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        <div className="dialog-actions">
          <span>Total {cents(totals.totalCents)}{totals.optionalCents ? `, plus ${cents(totals.optionalCents)} optional` : ''}. Sales tax is not added.{totals.problem ? ` ${totals.problem}` : ''}</span>
          <button className="primary" disabled={busy || !ready}>{busy ? 'Saving' : 'Save proposal'}</button>
        </div>
      </form>
    </Modal>
  );
}
