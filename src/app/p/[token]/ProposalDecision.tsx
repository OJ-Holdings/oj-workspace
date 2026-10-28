'use client';

import { useState } from 'react';
import { decideProposal } from './actions';

type Optional = { id: string; description: string; amount_cents: number };
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** The customer's accept or decline, with a typed signature and any optional add-ons. Plain and large: it is read on a phone. */
export function ProposalDecision({ token, baseCents, optional }: { token: string; baseCents: number; optional: Optional[] }) {
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ decision: 'accepted' | 'declined'; agreedCents: number } | null>(null);
  const total = baseCents + optional.filter(o => picked.includes(o.id)).reduce((t, o) => t + o.amount_cents, 0);

  const send = async (decision: 'accepted' | 'declined') => {
    setBusy(true); setError('');
    const r = await decideProposal(token, { decision, name, note, optionalIds: picked });
    setBusy(false);
    if (r.ok) setDone({ decision: r.decision, agreedCents: r.agreedCents }); else setError(r.message);
  };

  if (done) return <div className="decision-done" role="status"><h2>{done.decision === 'accepted' ? 'Thank you. This proposal is accepted.' : 'Thank you. We have recorded that you declined.'}</h2>
    <p>{done.decision === 'accepted' ? `You agreed to ${money(done.agreedCents)}. We will be in touch to schedule the work. You can print this page for your records.` : 'If anything changes, just let us know.'}</p>
    {done.decision === 'accepted' && <p>Selected optional services: {optional.filter(o => picked.includes(o.id)).map(o => o.description).join(', ') || 'None'}</p>}</div>;

  return (
    <form className="decision" onSubmit={e => { e.preventDefault(); if (agree && name.trim().length >= 2) void send('accepted'); }}>
      <h2>Accept this proposal</h2>
      {optional.length > 0 && <fieldset><legend>Optional services (add any you want)</legend>
        {optional.map(o => <label key={o.id} className="check"><input type="checkbox" checked={picked.includes(o.id)} onChange={e => setPicked(e.target.checked ? [...picked, o.id] : picked.filter(x => x !== o.id))} /> {o.description}, {money(o.amount_cents)}</label>)}
      </fieldset>}
      <p className="agreed">Total you are agreeing to: <b>{money(total)}</b></p>
      <label>Type your full name to sign<input required autoComplete="name" maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> I have read this proposal and agree to its price and terms.</label>
      {error && <p className="decision-error" role="alert">{error}</p>}
      <button type="submit" className="accept" disabled={busy || !agree || name.trim().length < 2}>{busy ? 'Saving' : 'Accept and sign'}</button>
      <details><summary>Decline instead</summary>
        <label>Reason (optional)<input maxLength={300} value={note} onChange={e => setNote(e.target.value)} /></label>
        <button type="button" className="decline" disabled={busy || name.trim().length < 2} onClick={() => void send('declined')}>Decline this proposal</button>
        <p className="muted">Type your name above first.</p>
      </details>
    </form>
  );
}
