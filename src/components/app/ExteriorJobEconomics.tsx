'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,Calculator,CheckCircle2,ClipboardCopy,RefreshCw,ShieldAlert,TrendingUp,Wallet} from 'lucide-react';
import type {ExtBooking,ExtLead} from '@/lib/exterior';
import {parseLocalEstimateBook,type ExteriorEstimate} from '@/lib/exterior-estimate';
import type {ExteriorFieldLog} from '@/lib/exterior-field-log';
import {jobEconomicsInternalBrief,reviewJobEconomics} from '@/lib/exterior-job-economics';

type Props={
 org:string;lead:ExtLead;booking:ExtBooking;bookings:readonly ExtBooking[];
 field:ExteriorFieldLog|null;mode:'live'|'preview';readOnly:boolean;base:string;
};
const money=(n:number|null|undefined)=>n===null||n===undefined?'Unknown':
 new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export function ExteriorJobEconomics({org,lead,booking,bookings,field,mode,readOnly,base}:Props){
 const [localEstimate,setLocalEstimate]=useState<ExteriorEstimate|null>(null);
 const [sourceNotice,setSourceNotice]=useState('');
 const [copyNotice,setCopyNotice]=useState('');
 const [loaded,setLoaded]=useState(false);
 const refresh=useCallback(()=>{
  setLocalEstimate(null);setSourceNotice('');setCopyNotice('');
  if(mode!=='live'||readOnly){
   setSourceNotice('Local draft comparison unavailable in read-only/preview mode. Nothing is read from the browser.');
   setLoaded(true);return;
  }
  try{
   const raw=window.localStorage.getItem('oj-exterior-estimate-v1:'+org+':'+lead.id);
   if(!raw){setSourceNotice('No local estimating draft is saved in this browser for this exact source lead.');setLoaded(true);return;}
   const book=parseLocalEstimateBook(raw,lead.id);
   setLocalEstimate(book.current);
   setSourceNotice('Local estimating draft loaded from this browser; it is not a shared approved work order.');
  }catch{
   setSourceNotice('The existing browser estimate could not be validated. It was left untouched and excluded from job economics.');
  }
  setLoaded(true);
 },[org,lead.id,mode,readOnly]);
 useEffect(()=>{refresh();},[refresh]);
 const review=useMemo(()=>{
  try{return {ok:true as const,data:reviewJobEconomics(booking,lead,bookings,field,localEstimate)};}
  catch(e){return {ok:false as const,message:e instanceof Error?e.message:'Economics sources are incomplete.'};}
 },[booking,lead,bookings,field,localEstimate]);
 const report=review.ok?review.data:null;
 const copy=async()=>{
  if(!report)return;
  try{await navigator.clipboard.writeText(jobEconomicsInternalBrief(report,lead,booking));
   setCopyNotice('Internal review copied. Nothing was sent, invoiced, booked, completed or paid.');}
  catch{setCopyNotice('Clipboard permission unavailable. No external action occurred.');}
 };
 const estimateHref=base+'/b/exterior/estimate?lead='+encodeURIComponent(lead.id);
 const max=report?.planned?.cost!==null&&report?.planned?.cost!==undefined&&report.field?.totalDirectCost!==null&&report.field?.totalDirectCost!==undefined?
  Math.max(report.planned.cost,report.field.totalDirectCost,1):null;
 return <section className="ecfield-panel ecfield-economics" aria-label="Booking job economics comparison">
  <header className="ecfield-heading"><div><span className="ecfield-overline">10 / JOB ECONOMICS REVIEW</span>
    <h2>Estimate versus field costs</h2>
    <p>Reconciles locally entered scope and job costs against the exact source lead and booking. No payment, acceptance, or booked-job revenue is invented.</p>
   </div><Calculator size={22}/></header>
  {!loaded&&<p className="ecfield-disclaimer">Checking local estimate and field evidence…</p>}
  {sourceNotice&&<p className="ecfield-econ-context" role="status">{sourceNotice}</p>}
  {!review.ok&&<p className="ecfield-equip-warning" role="alert"><ShieldAlert size={17}/>{review.message} No financial comparison can be asserted.</p>}
  {report&&<>
   <div className="ecfield-econ-grid">
    <div><small>Original lead quoted amount</small><strong>{money(report.quoteAmount)}</strong><span>Source lead · not accepted / not cash</span></div>
    <div><small>Local estimated direct cost</small><strong>{money(report.planned?.cost)}</strong><span>{report.estimateSourceCurrent?'Current original source stamp':'Missing or stale source stamp'}</span></div>
    <div><small>Operator-entered direct cost</small><strong>{money(report.field?.totalDirectCost)}</strong><span>{report.field?.complete?'All categories reviewed locally':'Missing cost categories'}</span></div>
    <div><small>Reviewed crew time</small><strong>{report.fieldHoursReviewed===null?'Unknown':report.fieldHoursReviewed+' h'}</strong><span>Operator-entered; not payroll time</span></div>
   </div>
   <div className="ecfield-econ-scenario">
    <div><span className="ecfield-overline">QUOTE SCENARIO / NOT EARNED PROFIT</span><TrendingUp size={18}/></div>
    <strong>{money(report.quoteLessFieldCost)}</strong>
    <p>Original lead quoted amount minus fully reviewed, operator-entered direct costs, only when this lead has one active booking and sources are current.</p>
    <small>{report.quoteLessFieldCostRatio===null?'Scenario ratio unavailable':report.quoteLessFieldCostRatio+'% scenario remainder / quoted amount'} · Customer approval and money received remain unverified.</small>
   </div>
   {max!==null&&report?.estimateSourceCurrent&&report?.fieldSourceCurrent&&<div className="ecfield-econ-bars" aria-label="Local planned and reviewed field cost comparison">
     <div><label>Local planned costs <strong>{money(report.planned?.cost)}</strong></label>
      <span><i style={{width:((report.planned!.cost??0)/max*100)+'%'}}/></span></div>
     <div><label>Operator-entered costs <strong>{money(report.field?.totalDirectCost)}</strong></label>
      <span><i style={{width:((report.field?.totalDirectCost??0)/max*100)+'%'}}/></span></div>
     <p>Planning and field estimates only; bar widths are scaled to the larger entered cost, not verified bank spending.</p>
   </div>}
   <div className="ecfield-econ-variance">
    <span>Local planned cost minus reviewed field cost</span>
    <strong>{money(report.plannedCostMinusFieldCost)}</strong>
    <small>{report.plannedCostMinusFieldCost===null?'Unavailable until the plan and field data are source-current, complete and booking-unique.':'Positive means field cost estimate is lower than the local planned cost assumption; negative means higher.'}</small>
   </div>
   {report.comparable?
    <p className="ecfield-econ-eligible"><CheckCircle2 size={16}/> Numeric scenario sources are comparable, but quote acceptance and collection remain unverified.</p>:
    <div className="ecfield-econ-gaps"><strong>Comparison currently withheld</strong>
     <ul>{report.comparisonReasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
   <div className="ecfield-econ-warnings"><span className="ecfield-overline">EVIDENCE GAPS & ACCOUNTING CAVEATS</span>
    <ul>{report.warnings.map(w=><li key={w}>{w}</li>)}</ul>
   </div>
  </>}
  <div className="ecfield-econ-actions">
   <Link href={estimateHref}><Wallet size={15}/> Open source lead estimator <ArrowUpRight size={14}/></Link>
   <button type="button" onClick={refresh}><RefreshCw size={15}/> Reload local estimate</button>
   <button type="button" disabled={!report} onClick={copy}><ClipboardCopy size={15}/> Copy internal review</button>
  </div>
  {copyNotice&&<p className="ecfield-toast" role="status">{copyNotice}</p>}
 </section>;
}
