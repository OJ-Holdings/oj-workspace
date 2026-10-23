'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Landmark, SearchCheck, ShieldAlert } from 'lucide-react';
import type { FinanceEntry, MercurySnapshot } from '@/lib/dashboard';
import { bankReviewSnapshot } from '@/lib/atlas-bank-review';

type Props = {
  bank: MercurySnapshot | undefined;
  entries: readonly FinanceEntry[];
  month: string | null;
  entryHref: (id: string) => string;
};
const amount = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(value);

/** Owner-only source comparison, never evidence that any account or entry is reconciled. */
export function AtlasBankReview({bank,entries,month,entryHref}: Props) {
  const [filter,setFilter] = useState<'all'|'suggested'|'inspect'>('all');
  const [search,setSearch] = useState('');
  const [shown,setShown] = useState(8);
  const review = useMemo(()=>bankReviewSnapshot(bank,entries,month),[bank,entries,month]);
  const q=search.trim().toLowerCase();
  const rows=review.rows.filter(row=>
    (filter==='all'||(filter==='suggested' ? row.candidates.length>0 : row.candidates.length===0)) &&
    (!q||[row.description,row.accountName,row.status,row.kind,row.bankDay??'']
      .some(v=>v.toLowerCase().includes(q))));
  return <section className="atlas-bank-review" aria-labelledby="atlas-bank-review-heading">
    <div className="atlas-bank-review-top">
      <div>
        <span className="atlas-treasury-kicker">ACCOUNTING / BANK EXCEPTIONS</span>
        <h2 id="atlas-bank-review-heading"><Landmark aria-hidden="true" size={20}/> Reconciliation desk <small>Review-only</small></h2>
        <p>Compare recorded operating entries with your private Mercury transaction feed. Same-amount suggestions are <strong>not reconciled transactions</strong>.</p>
      </div>
      <span className="atlas-bank-review-source">{review.state==='available'?'Bank feed available':review.state.replaceAll('-',' ')} · {review.checkedAt ? new Date(review.checkedAt).toLocaleString('en-US') : 'No source timestamp'}</span>
    </div>
    {review.state!=='available' ? <div className="atlas-bank-review-unknown">
      <ShieldAlert size={20} aria-hidden="true"/>
      <div><b>Bank comparison cannot be completed.</b><p>{review.detail} No transactions or matching conclusions are inferred from an unavailable or partial source.</p></div>
    </div> : <>
      <p className="atlas-bank-review-intro">{review.scopeNote} {month ? `Viewing bank dates within ${month}.` : 'Viewing the latest returned bank activity.'} The bank API supplies its original status and signed amount; these do not establish income versus expense.</p>
      <div className="atlas-bank-review-controls">
        <div role="group" aria-label="Bank activity review filter" className="atlas-bank-review-chips">
          <button type="button" aria-pressed={filter==='all'} onClick={()=>{setFilter('all');setShown(8)}}>Recent activity</button>
          <button type="button" aria-pressed={filter==='suggested'} onClick={()=>{setFilter('suggested');setShown(8)}}>Suggested records</button>
          <button type="button" aria-pressed={filter==='inspect'} onClick={()=>{setFilter('inspect');setShown(8)}}>Needs source inspection</button>
        </div>
        <input type="search" aria-label="Search bank activity" value={search} onChange={e=>{setSearch(e.target.value);setShown(8)}} placeholder="Bank description, status or date"/>
      </div>
      {rows.length ? <div className="atlas-bank-review-list">
        {rows.slice(0,shown).map(row=><article className="atlas-bank-review-item" key={row.id}>
          <header>
            <div><small>{row.accountName} · {row.bankDay ?? 'Bank date unknown'} · {row.daySource==='postedAt'?'Bank postedAt field':row.daySource==='createdAt'?'Bank createdAt field':'Date unavailable'}</small>
              <h3>{row.description || 'No bank description supplied'}</h3>
              <span>Bank status: {row.status} · Type: {row.kind}</span>
            </div>
            <strong>{amount(row.signedAmount,row.currency)}</strong>
          </header>
          {row.limitation && <p className="atlas-bank-review-limitation">{row.limitation}</p>}
          <div className="atlas-bank-review-candidates">
            {row.candidates.length ? <>
              <b><SearchCheck size={15} aria-hidden="true"/> Same-amount records to inspect {row.candidates.length>1?'(ambiguous)':''}</b>
              <div>
                {row.candidates.slice(0,4).map(candidate=><Link key={candidate.id} href={entryHref(candidate.id)} className="atlas-bank-review-candidate">
                  <span>{candidate.category} · {candidate.venture} · {candidate.kind==='revenue'?'Recorded in':'Recorded out'} · {candidate.recordedDate}</span>
                  <small>{candidate.dayDistance===0?'Same recorded day':`${candidate.dayDistance} days apart`}{candidate.dateBasis?` · Source date: ${candidate.dateBasis.replaceAll('-',' ')}`:''}</small>
                  <ArrowRight aria-hidden="true" size={14}/>
                </Link>)}
              </div>
              {row.candidates.length>4 && <p>{row.candidates.length-4} additional candidate records exist. Narrow the accounting ledger by amount/date to inspect them.</p>}
            </> : <p>No same-amount operating entry was suggested within the four-day comparison window. This does not establish that an expense, revenue entry or settlement is missing.</p>}
          </div>
        </article>)}
      </div> : <p className="atlas-bank-review-empty">No returned bank activity matches this view. The bank feed is limited to recent transactions; this does not establish that the account had no other activity.</p>}
      {rows.length>shown && <button type="button" className="secondary atlas-bank-review-more" onClick={()=>setShown(n=>n+8)}>Show more bank activity</button>}
    </>}
    <p className="atlas-bank-review-foot">No bank or bookkeeping writes occur here. No candidate is saved or called reconciled. To create a verified reconciliation, ATLAS will need complete statements, entity-scoped ledger accounts, confirmed matching, approvals and a locked-period audit trail.</p>
  </section>;
}
