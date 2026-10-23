'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, FileSearch, FileSpreadsheet, LockKeyhole, ShieldAlert } from 'lucide-react';
import type { FinanceEntry } from '@/lib/dashboard';
import {
  compareStatementRow, parseStatementCsv, statementRollForward,
  type StatementImport,
} from '@/lib/atlas-statement-review';

type Props = { entries: readonly FinanceEntry[]; period: string | null; entryHref: (id:string)=>string };
const usd = (n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);

/** Private browser-memory source inspection; no upload to OJ servers or bank APIs. */
export function AtlasStatementInspector({entries,period,entryHref}:Props){
  const [fileName,setFileName]=useState('');
  const [statement,setStatement]=useState<StatementImport|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [opening,setOpening]=useState('');
  const [closing,setClosing]=useState('');
  const [shown,setShown]=useState(10);
  const [mode,setMode]=useState<'all'|'candidates'|'inspect'>('all');
  const [pending,setPending]=useState(false);
  const roll=useMemo(()=>statement ? statementRollForward(statement,opening,closing) : null,[statement,opening,closing]);
  const rows=useMemo(()=>{
    if(!statement)return [];
    return statement.rows
      .filter(row=>!period||row.date.startsWith(period))
      .map(row=>({...row,candidates:compareStatementRow(row,entries)}))
      .filter(row=>mode==='all'||(mode==='candidates'?row.candidates.length>0:row.candidates.length===0));
  },[statement,entries,period,mode]);
  const selectFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!file)return;
    setFileName(file.name);
    setStatement(null);setError(null);setOpening('');setClosing('');setShown(10);setMode('all');
    if(file.size>1_048_576){setError('CSV exceeds 1 MiB. Split by bank statement period.');return;}
    setPending(true);
    try{
      const text=await file.text();
      const result=parseStatementCsv(text);
      setStatement(result);
    }catch(e){setError(e instanceof Error ? e.message : 'Could not read or validate this CSV.');}
    finally{setPending(false);}
  };
  return <section className="atlas-statement-inspector" aria-labelledby="atlas-statement-heading">
    <header className="atlas-statement-header">
      <div>
        <span className="atlas-treasury-kicker">ACCOUNTING / LOCAL STATEMENT INSPECTION</span>
        <h2 id="atlas-statement-heading"><FileSpreadsheet size={21} aria-hidden="true"/> Inspect bank statement</h2>
        <p>Bring a downloaded CSV statement into ATLAS to verify its arithmetic and investigate matching operating records. <strong>Nothing is uploaded, stored or posted.</strong></p>
      </div>
      <label className="atlas-statement-file">
        <FileSearch size={16} aria-hidden="true"/>
        {pending ? 'Reading file…' : 'Choose bank CSV'}
        <input type="file" accept=".csv,text/csv" disabled={pending} onChange={selectFile} aria-label="Choose local bank statement CSV"/>
      </label>
    </header>
    <div className="atlas-statement-privacy"><LockKeyhole size={15} aria-hidden="true"/>
      <span>Private browser-memory review. The selected file is read only on this device and discarded when this view is closed or refreshed. Avoid selecting personal bank statements in a shared session.</span>
    </div>
    {!statement && !error && <div className="atlas-statement-start">
      <b>Accepted CSV columns</b>
      <p><code>Date, Description, Amount</code> or <code>Date, Description, Debit, Credit</code>. Optional Currency column must be USD; dates must be YYYY-MM-DD or MM/DD/YYYY. Amounts may be negative or in parentheses.</p>
      <p>Only statement rows you select are compared. A signed bank amount is never automatically classified as a sale, expense, transfer, distribution or tax deduction.</p>
    </div>}
    {error && <p role="alert" className="atlas-statement-error"><ShieldAlert size={16} aria-hidden="true"/> {error}</p>}
    {statement && <>
      <div className="atlas-statement-file-summary">
        <div><small>SELECTED FILE</small><strong>{fileName}</strong>
          <span>{statement.dateRange ? `${statement.dateRange.start} to ${statement.dateRange.end}` : 'No valid transaction dates'}</span></div>
        <div><small>PARSED MOVEMENT</small><strong>{statement.status==='accepted'&&statement.rows.length ? usd(statement.totalCents) : 'Not reliable'}</strong>
          <span>{statement.rows.length} validated rows · {statement.problems.length} rejected; not necessarily a complete bank statement</span></div>
      </div>
      {statement.problems.length>0 && <div role="alert" className="atlas-statement-errors">
        <b>CSV requires correction before arithmetic can be checked</b>
        {statement.problems.slice(0,10).map(p=><p key={p.rowNumber}>CSV row {p.rowNumber}: {p.reason}</p>)}
        {statement.problems.length>10 && <p>Another {statement.problems.length-10} rejected rows are not displayed. Correct the source file and reload it.</p>}
      </div>}
      <div className="atlas-statement-balance">
        <div><h3>Statement roll-forward</h3><p>Enter opening and closing balances as shown by the bank. ATLAS checks the supplied rows; arithmetic consistency is not reconciliation.</p></div>
        <label>Opening balance (USD)<input aria-label="Statement opening balance" inputMode="decimal" placeholder="e.g. 2,500.00" value={opening} onChange={e=>setOpening(e.target.value)}/></label>
        <label>Closing balance (USD)<input aria-label="Statement closing balance" inputMode="decimal" placeholder="e.g. 2,754.40" value={closing} onChange={e=>setClosing(e.target.value)}/></label>
      </div>
      {roll && <div className="atlas-statement-result" role="status">
        <strong>{roll.status==='arithmetic-consistent'?'Supplied arithmetic consistent':roll.status==='arithmetic-difference'?'Statement difference detected':'Verification incomplete'}</strong>
        <span>{roll.detail}</span>
        {roll.varianceCents!==null && <b>Difference: {usd(roll.varianceCents)}</b>}
      </div>}
      <div className="atlas-statement-review-head">
        <div><h3>Transaction comparison</h3>
          <p>Potential links use equal absolute USD amounts and dates within four days. Multiple possibilities remain ambiguous. No match is saved or accepted automatically.</p></div>
        <div role="group" aria-label="Statement review filter">
          {(['all','candidates','inspect'] as const).map(v=><button key={v} type="button" aria-pressed={mode===v} onClick={()=>{setMode(v);setShown(10)}}>
            {v==='all'?'All selected rows':v==='candidates'?'Possible links':'Inspect separately'}
          </button>)}
        </div>
      </div>
      {period && <p className="atlas-statement-scope">Reviewing statement rows dated {period}. The full uploaded file is still used for the balance roll-forward above. Change the Finance month filter to review another period.</p>}
      {rows.length>0 ? <div className="atlas-statement-grid">
        {rows.slice(0,shown).map(r=><article key={r.rowNumber} className="atlas-statement-row">
          <header><div><small>{r.date} · CSV row {r.rowNumber}</small><h4>{r.description}</h4></div><strong>{usd(r.signedCents)}</strong></header>
          {r.candidates.length ? <div className="atlas-statement-links">
            <b>Possible ledger entries {r.candidates.length>1?'— multiple candidates':''}</b>
            {r.candidates.slice(0,5).map(c=><Link href={entryHref(c.entryId)} key={c.entryId}>
              <span>{c.category} · {c.venture} · {c.kind==='revenue'?'Recorded in':'Recorded out'} · {c.recordedDate}</span>
              <small>{c.distanceDays} days apart · {c.source==='manual-entry'?'Manual':'Imported'} source</small>
              <ArrowRight size={13} aria-hidden="true"/>
            </Link>)}
            {r.candidates.length>5 && <small>Additional possible links omitted; narrow the source ledger.</small>}
          </div> : <p>No equal-amount nearby operating entry suggested. Not evidence that money is missing or incorrectly recorded.</p>}
        </article>)}
      </div> : <p className="atlas-statement-empty">No validated statement rows match this period or review filter. This is not proof of no account activity.</p>}
      {rows.length>shown && <button type="button" className="secondary" onClick={()=>setShown(v=>v+10)}>Show more statement rows</button>}
    </>}
    <p className="atlas-statement-footnote">A complete reconciliation additionally needs verified bank statements, the correct legal-entity cash accounts, actual approved journal postings, cleared/pending treatment, and audit evidence. Even a perfectly balancing imported CSV does not certify that all transactions or bank accounts were included.</p>
  </section>;
}
