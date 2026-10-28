'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { addJobExpense, loadJobExpenses, removeJobExpense, type JobExpense } from '@/app/workspace/exterior-actions';
import { dollars } from '@/lib/metrics';
import type { Act } from './ExteriorManage';

const kinds: [string, string][] = [['materials', 'Materials'], ['fuel', 'Fuel'], ['labor', 'Labor'], ['equipment', 'Equipment'], ['other', 'Other']];
const kindName = (k: string) => kinds.find(([id]) => id === k)?.[1] ?? k;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

/**
 * The cost side of a job, itemised: materials, fuel, labor, equipment. The total becomes the job's cost, which the Money page and reports read.
 * Until the job-expenses SQL has been run (or in the sample workspace) it shows `fallback`, the single cost box, so nothing is lost.
 */
export function JobCosts({ org, leadId, live, readOnly, act, busy, onTotal, fallback }: { org: string; leadId: string; live: boolean; readOnly: boolean; act: Act; busy: boolean; onTotal: (total: number | null) => void; fallback: ReactNode }) {
  const [rows, setRows] = useState<JobExpense[] | null>(null);
  const [kind, setKind] = useState('materials');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const reload = useCallback(async () => {
    if (!live) { setRows(null); return; }
    try { const r = await loadJobExpenses(org, leadId); setRows(r.ok && r.setUp ? r.expenses : null); } catch { setRows(null); }
  }, [org, leadId, live]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { onTotal(rows && rows.length ? Math.round(rows.reduce((t, r) => t + r.amount, 0) * 100) / 100 : null); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (rows === null) return <>{fallback}</>;
  const total = rows.reduce((t, r) => t + r.amount, 0);
  const add = async () => {
    const ok = await act(() => addJobExpense(org, leadId, { kind, amount, note, spent_on: today() }), () => 'Cost added.');
    if (ok) { setAmount(''); setNote(''); await reload(); }
  };
  return (
    <div className="jobcosts">
      <div className="jobcosts-head"><span>Job costs</span><b>{rows.length ? dollars(total) : 'None entered'}</b></div>
      {rows.length > 0 && <ul>{rows.map(r => <li key={r.id}>
        <span>{kindName(r.kind)}{r.note ? `, ${r.note}` : ''}</span><b>{dollars(r.amount)}</b>
        {!readOnly && <button type="button" className="icon-button" aria-label={`Remove ${kindName(r.kind)} cost`} disabled={busy} onClick={async () => { if (await act(() => removeJobExpense(org, r.id), () => 'Cost removed.')) await reload(); }}><Trash2 size={14} aria-hidden="true" /></button>}
      </li>)}</ul>}
      {!readOnly && <div className="jobcosts-add">
        <select aria-label="What the money was for" value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <input type="number" min="0" step="0.01" inputMode="decimal" aria-label="Amount" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
        <input type="text" maxLength={300} aria-label="Note" placeholder="What for (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <button type="button" className="secondary small" disabled={busy || amount.trim() === ''} onClick={() => void add()}>Add cost</button>
      </div>}
    </div>
  );
}
