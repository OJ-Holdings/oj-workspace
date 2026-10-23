'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList, Download, FileWarning, LockKeyhole } from 'lucide-react';
import type { Dashboard } from '@/lib/dashboard';
import type { VentureId } from '@/lib/ventures';
import { buildClosePrep, closePrepBrief } from '@/lib/atlas-close-prep';

type Props = {
  data: Pick<Dashboard,'finance'|'reporting'|'mercury'>;
  month: string;
  scope: readonly VentureId[];
  owner: boolean;
  entryHref: (id: string) => string;
};
/** A month-end preparation checklist, not a month-close operation or CPA declaration. */
export function AtlasMonthEndPrep({data,month,scope,owner,entryHref}:Props) {
  const [showAll,setShowAll] = useState(false);
  const prep = useMemo(()=>buildClosePrep(data,month,scope,owner),[data,month,scope,owner]);
  const shown = showAll ? prep.actionable : prep.actionable.slice(0,4);
  const exportBrief=()=>{
    if (!window.confirm('Export an accounting preparation brief? This is an UNRECONCILED review document, not posted books, a tax return, or professional signoff. Check it before sharing.')) return;
    const text=closePrepBrief(prep,new Date().toISOString());
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=`atlas-close-prep-${month}.txt`;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="atlas-close-prep" aria-labelledby="atlas-close-heading">
    <header className="atlas-close-prep-header">
      <div>
        <span className="atlas-treasury-kicker">ACCOUNTING / MONTH-END PREPARATION</span>
        <h2 id="atlas-close-heading"><ClipboardList size={22} aria-hidden="true"/> Prepare the books <small>{month}</small></h2>
        <p>Turn transactions into a reviewable accounting workpaper. This workspace is not yet capable of certifying or posting a completed period close.</p>
      </div>
      <button type="button" className="secondary" onClick={exportBrief}><Download size={15} aria-hidden="true"/>Download preparation brief</button>
    </header>
    <div className="atlas-close-prep-columns">
      <div className="atlas-close-prep-section">
        <h3><FileWarning size={16} aria-hidden="true"/> Records to investigate</h3>
        {shown.length ? <div className="atlas-close-prep-issues">
          {shown.map(issue=><div key={issue.id}>
            <b>{issue.title}</b>
            <p>{issue.detail}</p>
            {issue.entryId && <Link href={entryHref(issue.entryId)}>Inspect original entry <ArrowRight size={13} aria-hidden="true"/></Link>}
          </div>)}
        </div> : <p className="atlas-close-prep-empty">No record-specific issues were detected within loaded sources. That does not mean all receipts, bills or accounting treatments are verified.</p>}
        {prep.actionable.length>4 && <button type="button" className="secondary small" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer':'Show all review items'}</button>}
      </div>
      <div className="atlas-close-prep-section">
        <h3><LockKeyhole size={16} aria-hidden="true"/> Requirements before close</h3>
        <div className="atlas-close-prep-blockers">
          {prep.blockers.map(item=><div key={item.id}><b>{item.title}</b><p>{item.detail}</p></div>)}
        </div>
      </div>
    </div>
    <footer><b>Period cannot be marked closed.</b> {prep.sourceNote}</footer>
  </section>;
}
