'use client';

import {useMemo,useState} from 'react';
import {AlertTriangle,ArrowUpRight,CheckCircle2,ClipboardCopy,FileCheck2,ShieldAlert} from 'lucide-react';
import type {ExtBooking,ExtLead} from '@/lib/exterior';
import type {ExteriorFieldLog} from '@/lib/exterior-field-log';
import {internalCloseoutBrief,reviewInternalCloseout} from '@/lib/exterior-closeout-review';

type Props={
 booking:ExtBooking;lead:ExtLead;bookings:readonly ExtBooking[];
 bookingCoverageComplete:boolean;field:ExteriorFieldLog|null;
 readOnly:boolean;mode:'live'|'preview';
};
const currency=(n:number|null)=>n===null?'Unknown':
 new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

/** R34: operator-only mobile review. No external messages, invoices, status writes or sync. */
export function ExteriorCloseoutReview({
 booking,lead,bookings,bookingCoverageComplete,field,readOnly,mode,
}:Props){
 const [feedback,setFeedback]=useState('');
 const state=useMemo(()=>{
  try{return {ok:true as const,value:reviewInternalCloseout(
   booking,lead,bookings,field,bookingCoverageComplete)};
  }catch(e){return {ok:false as const,error:e instanceof Error?e.message:'Exact source review is unavailable.'};}
 },[booking,lead,bookings,field,bookingCoverageComplete]);
 const result=state.ok?state.value:null;
 const copy=async()=>{
  if(!result||mode==='preview'||readOnly)return;
  try{
   await navigator.clipboard.writeText(internalCloseoutBrief(result,lead,booking));
   setFeedback('Private internal review copied. No job, quote, invoice, payroll or payment status was changed.');
  }catch{setFeedback('Clipboard access unavailable. Nothing was sent or changed.');}
 };
 return <section className="ecfield-panel ecfield-handoff" aria-label="Internal job closeout preparation">
  <header className="ecfield-heading">
   <div><span className="ecfield-overline">11 / CREW CLOSEOUT HANDOFF</span>
    <h2>Prepare the job for owner review</h2>
    <p>One check before you hand over the work: actual field entries, cost completeness, and remaining issues. This does not complete the job or authorize an invoice.</p>
   </div><FileCheck2 size={22}/>
  </header>
  {!result?<p className="ecfield-equip-warning" role="alert"><ShieldAlert size={17}/>
   {state.ok?'Original source review unavailable.':state.error}</p>:<>
   <div className="ecfield-handoff-summary" data-ready={result.reviewable?'yes':'no'}>
    <div className="ecfield-handoff-status">
     {result.reviewable?<CheckCircle2 size={20}/>:<AlertTriangle size={20}/>}
     <div><strong>{result.reviewable?'Field draft ready for INTERNAL review':'Field handoff needs attention'}</strong>
      <small>{result.reviewable?
       'No local checklist blockers found. Source-backed completion, approval and collections remain unverified.':
       result.blockers.length+' action'+(result.blockers.length===1?'':'s')+' to review before a private handoff.'}</small>
     </div>
    </div>
    <div className="ecfield-handoff-stat">
     <div><span>Operator-reviewed direct cost</span><strong>{currency(result.fieldCost?.totalDirectCost??null)}</strong></div>
     <div><span>Reviewed crew time</span><strong>{result.hoursReviewed===null?'Unknown':result.hoursReviewed+' h'}</strong></div>
     <div><span>Original lead quote</span><strong>{currency(result.quoteAmount)}</strong><small>Not an accepted price or collected money</small></div>
    </div>
   </div>
   {result.blockers.length>0&&<div className="ecfield-handoff-actions">
    <strong>Resolve before handoff</strong>
    <ol>{result.blockers.map(f=><li key={f.code}>
     <span>{f.label}</span>
     <a href={'#ecfield-'+f.location} aria-label={'Review '+f.label}>Review <ArrowUpRight size={13}/></a>
    </li>)}</ol>
   </div>}
   <details className="ecfield-handoff-caveats" open={!result.reviewable}>
    <summary>Evidence limits and owner verification</summary>
    <ul>{result.cautions.map(x=><li key={x}>{x}</li>)}</ul>
   </details>
   <button className="ecfield-handoff-copy" type="button" onClick={()=>void copy()}
    disabled={mode==='preview'||readOnly}>
    <ClipboardCopy size={17}/> Copy private owner handoff
   </button>
   <p className="ecfield-disclaimer">
    This packet never updates corporate records or transmits to a customer. Cost figures and stage are operator-entered, saved only in this browser. Manual owner signoff and actual billing/payment verification happen elsewhere.
   </p>
  </>}
  {feedback&&<p className="ecfield-toast" role="status">{feedback}</p>}
 </section>;
}
