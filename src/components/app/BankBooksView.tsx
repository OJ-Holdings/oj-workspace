'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadBankQueue, postBankItems, type BankQueue } from '@/app/workspace/bank-actions';
import { bankDifference, ledgerForBankAccount, MAX_POST_BATCH, type Division } from '@/lib/bank-books';
import { dollars } from '@/lib/metrics';

type Props = { org: string; mode: 'preview' | 'live'; owner: boolean };
const cents = (n: number) => dollars(n / 100);
const DIVISIONS: Division[] = ['exterior', 'solutions', 'essentials', 'content', 'shared'];
const SHOWN = 100;
const when = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

/**
 * Bank to books. Every completed Mercury transaction waits here until it is given a category; posting writes one balanced journal entry. The bank's own balance
 * sits beside the books' balance so you can see when the two agree. Posting the same transaction twice does nothing.
 */
export function BankBooksView({ org, mode, owner }: Props) {
  const [q, setQ] = useState<BankQueue | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState('all');
  const [onlySuggested, setOnlySuggested] = useState(false);
  const [bankMap, setBankMap] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<Record<string, string>>({});
  const [division, setDivision] = useState<Record<string, Division>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => { setQ(await loadBankQueue(org)); }, [org]);
  useEffect(() => { if (mode === 'live' && owner) void refresh(); }, [mode, owner, refresh]);

  const ledgerByCode = useMemo(() => new Map((q && q.ok ? q.ledger : []).map(a => [a.code, a])), [q]);
  /** The ledger account for each bank account: what the owner chose, otherwise the one its name points to. */
  const bankLedger = useCallback((id: string, name: string) => bankMap[id] ?? (ledgerByCode.get(ledgerForBankAccount(name)?.code ?? '')?.id ?? ''), [bankMap, ledgerByCode]);

  if (mode === 'preview') return <section className="panel"><p className="quiet">The bank queue works in your live workspace. The sample workspace never touches the bank or the books.</p></section>;
  if (!owner) return <section className="panel" role="status"><h2>Owners only</h2><p className="quiet">The bank connection and the books are visible to workspace owners.</p></section>;
  if (!q) return <div className="loading" aria-busy="true" />;
  if (!q.ok) {
    const text = { 'owner-only': 'Owners only.', 'not-connected': 'The bank is not connected, or did not answer. Check the Mercury token and try again.', 'not-set-up': 'Set up the chart of accounts on the Invoices page first.', failed: 'The queue did not load.' }[q.reason];
    return <section className="panel" role="alert"><h2>Bank to books</h2><p>{text}</p><button className="primary" onClick={() => { setQ(null); void refresh(); }}>Try again</button></section>;
  }

  const names = new Map(q.accounts.map(a => [a.id, a.name]));
  const rows = q.rows.filter(r => !r.paired && (account === 'all' || r.accountId === account) && (!onlySuggested || r.suggest));
  const shown = rows.slice(0, SHOWN);
  const pairedCount = q.rows.filter(r => r.paired).length;
  const catOf = (r: typeof rows[number]) => category[r.id] ?? (r.suggest ? ledgerByCode.get(r.suggest.code)?.id ?? '' : '');
  const divOf = (r: typeof rows[number]) => division[r.id] ?? ledgerForBankAccount(r.accountName)?.division ?? 'exterior';
  const ready = (r: typeof rows[number]) => Boolean(catOf(r) && bankLedger(r.accountId, r.accountName));
  const chosen = shown.filter(r => picked.has(r.id) && ready(r)).slice(0, MAX_POST_BATCH);

  // Bank versus books, grouped by ledger account because several bank accounts can share one (for example every Clearing account).
  const groups = new Map<string, { code: string; name: string; type: string; bank: number; known: boolean }>();
  for (const a of q.accounts) {
    const id = bankLedger(a.id, a.name); const l = q.ledger.find(x => x.id === id);
    if (!l) continue;
    const g = groups.get(l.id) ?? { code: l.code, name: l.name, type: l.type, bank: 0, known: true };
    g.bank += a.balanceCents ?? 0; g.known = g.known && a.balanceCents !== null; groups.set(l.id, g);
  }
  const compare = [...groups.values()].map(g => { const t = q.balances.find(b => b.code === g.code); return { ...g, ...bankDifference(g.bank, t?.debit ?? 0, t?.credit ?? 0, g.type === 'liability') }; });

  const post = async () => {
    setBusy(true); setNotice('');
    try {
      const r = await postBankItems(org, chosen.map(t => ({ txId: t.id, bankAccountId: bankLedger(t.accountId, t.accountName), categoryAccountId: catOf(t), division: divOf(t) })));
      if (!r.ok) setNotice(r.message);
      else { setNotice(`Posted ${r.posted}.${r.failed.length ? ` ${r.failed.length} did not post: ${r.failed[0].message}` : ''}`); setPicked(new Set()); await refresh(); }
    } catch { setNotice('That did not go through. Nothing was lost; try again.'); } finally { setBusy(false); }
  };

  return <>
    <p className="notice" role="status" aria-live="polite">{notice}</p>
    <section className="panel" aria-labelledby="bb-h">
      <header className="panel-head"><h2 id="bb-h">Bank versus books</h2></header>
      <div className="tablewrap"><table className="table">
        <caption className="sr-only">Bank balance against the books, by account</caption>
        <thead><tr><th scope="col">Account</th><th scope="col">At the bank</th><th scope="col">In the books</th><th scope="col">Not yet in the books</th></tr></thead>
        <tbody>{compare.map(c => <tr key={c.code}><th scope="row">{c.code} {c.name}</th><td>{cents(c.bank)}</td><td>{cents(c.books)}</td><td className={c.difference === 0 ? '' : 'neg'}>{c.difference === 0 ? 'Matches' : cents(c.difference)}</td></tr>)}</tbody>
      </table></div>
      <p className="quiet">{q.postedCount} transaction{q.postedCount === 1 ? '' : 's'} posted, {q.rows.length - pairedCount} waiting{pairedCount > 0 ? `, ${pairedCount} moves between your own accounts are posted from their incoming half` : ''}.{q.truncated ? ' Showing the newest 3,000 at the bank.' : ''} When everything is posted, the two columns agree.</p>
    </section>

    <section className="panel" aria-labelledby="bb-q">
      <header className="panel-head"><h2 id="bb-q">Waiting for a category</h2></header>
      <div className="form-grid">
        <label>Bank account<select value={account} onChange={e => setAccount(e.target.value)}><option value="all">All</option>{q.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label><input type="checkbox" checked={onlySuggested} onChange={e => setOnlySuggested(e.target.checked)} /> Only ones with a suggested category</label>
      </div>
      <details>
        <summary>Which books account is each bank account?</summary>
        <div className="form-grid">{q.accounts.map(a => (
          <label key={a.id}>{a.name}
            <select value={bankLedger(a.id, a.name)} onChange={e => setBankMap({ ...bankMap, [a.id]: e.target.value })}>
              <option value="">Choose</option>{q.ledger.filter(l => l.type === 'asset' || l.type === 'liability').map(l => <option key={l.id} value={l.id}>{l.code} {l.name}</option>)}
            </select>
          </label>))}
        </div>
      </details>
      <div className="tablewrap" style={{ maxHeight: '60vh', overflow: 'auto' }}>
        <table className="table">
          <caption className="sr-only">Bank transactions waiting to be posted</caption>
          <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all ready" checked={shown.length > 0 && shown.filter(ready).length > 0 && shown.filter(ready).every(r => picked.has(r.id))} onChange={e => setPicked(e.target.checked ? new Set(shown.filter(ready).map(r => r.id)) : new Set())} /></th><th scope="col">Date</th><th scope="col">Account</th><th scope="col">What</th><th scope="col">Amount</th><th scope="col">Category</th><th scope="col">Division</th></tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.id}>
              <td><input type="checkbox" aria-label={`Select ${r.counterparty || 'transaction'}`} disabled={!ready(r)} checked={picked.has(r.id) && ready(r)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
              <td>{when(r.day)}</td><td>{names.get(r.accountId) ?? r.accountName}</td>
              <th scope="row">{r.counterparty || r.note || r.kind}{r.suggest && <small className="quiet"> {r.suggest.reason}</small>}</th>
              <td className={r.cents < 0 ? 'neg' : ''}>{cents(r.cents)}</td>
              <td><select aria-label="Category" value={catOf(r)} onChange={e => { setCategory({ ...category, [r.id]: e.target.value }); setPicked(p => new Set(p).add(r.id)); }}>
                <option value="">Choose</option>{q.ledger.map(l => <option key={l.id} value={l.id}>{l.code} {l.name}</option>)}
              </select></td>
              <td><select aria-label="Division" value={divOf(r)} onChange={e => setDivision({ ...division, [r.id]: e.target.value as Division })}>{DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></td>
            </tr>))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="quiet">Nothing waiting. Every completed bank transaction is in the books.</p>}
      </div>
      <div className="dialog-actions">
        <span>{chosen.length} ready to post{rows.length > SHOWN ? `, showing ${SHOWN} of ${rows.length}` : ''}. Up to {MAX_POST_BATCH} at a time.</span>
        <button className="primary" disabled={busy || chosen.length === 0} onClick={() => void post()}>{busy ? 'Posting' : `Post ${chosen.length}`}</button>
      </div>
    </section>
  </>;
}
