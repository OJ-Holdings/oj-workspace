'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,CheckCircle2,ClipboardList,RefreshCw,ShieldAlert,UsersRound,X} from 'lucide-react';
import type {ExtBooking,ExteriorData} from '@/lib/exterior';
import {buildJobContinuity,type JobContinuityEvidence} from '@/lib/exterior-job-continuity';
import {ExteriorJobActionLoop} from './ExteriorJobActionLoop';
import {ExteriorDeviceReleaseProof} from './ExteriorDeviceReleaseProof';
import {loadExteriorSharedFollowups} from '@/app/workspace/exterior-followup-actions';

type Loaded=Extract<Awaited<ReturnType<typeof loadExteriorSharedFollowups>>,{ok:true}>;
type Props={
 data:ExteriorData;booking:ExtBooking;org:string;base:string;
 mode:'live'|'preview';readOnly:boolean;
 crew:{available:boolean;employeeName:string|null};
 close:()=>void;
};
const tags:Record<JobContinuityEvidence,{text:string;help:string}>={
 source:{text:'Source recorded',help:'Only the named source fields are available. Not all real-world facts are independently verified.'},
 review:{text:'Needs source review',help:'Original authoritative evidence is incomplete or inconclusive.'},
 'local-only':{text:'Device local',help:'Private operator data on this browser is not automatically shared with your cofounder.'},
 'not-built':{text:'Not connected',help:'This stage lacks a verified job-bound shared application.'},
};
const shortDay=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{
 month:'short',day:'numeric',year:'numeric',timeZone:'UTC',
});
export function ExteriorJobContinuity({
 data,booking,org,base,mode,readOnly,crew,close,
}:Props){
 const view=useMemo(()=>buildJobContinuity(data,booking,crew),[data,booking,crew]);
 const [report,setReport]=useState<Loaded|null>(null);
 const [loading,setLoading]=useState(false);
 const [failed,setFailed]=useState('');
 const [attempt,setAttempt]=useState(0);
 const [linkCopied,setLinkCopied]=useState(false);
 const liveAccess=mode==='live'&&!readOnly&&view.sourceLinked;
 const leadId=view.leadId??'';
 useEffect(()=>{
  if(!liveAccess){setReport(null);setFailed('');setLoading(false);return;}
  let active=true;
  setLoading(true);setReport(null);setFailed('');
  loadExteriorSharedFollowups(org,booking.id,leadId).then(result=>{
   if(!active)return;
   if(result.ok){setReport(result);setFailed('');}
   else{setReport(null);setFailed(result.reason);}
  },()=>{if(active){setReport(null);setFailed('Shared company task source could not be read. No tasks were invented.');}})
  .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[org,booking.id,leadId,liveAccess,attempt]);
 useEffect(()=>{
  if(!liveAccess)return;
  const refresh=()=>{if(document.visibilityState==='visible')setAttempt(n=>n+1);};
  window.addEventListener('oj-exterior-followup-saved',refresh);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return()=>{
   window.removeEventListener('oj-exterior-followup-saved',refresh);
   window.removeEventListener('focus',refresh);
   document.removeEventListener('visibilitychange',refresh);
  };
 },[liveAccess]);
 const matchesSource=!!report&&report.source.date===booking.date&&
  report.source.time===booking.time_block&&report.source.status===booking.status;
 const routeFor=(step:typeof view.steps[number])=>{
  if(step.route==='finance')return base+'/finance';
  const root=base+'/b/exterior';
  if(step.route==='customer')return view.leadId?root+'/customer?lead='+encodeURIComponent(view.leadId):root+'/leads';
  if(step.route==='estimate')return view.leadId?root+'/estimate?lead='+encodeURIComponent(view.leadId):root+'/estimate';
  if(step.route==='field')return root+'/field?booking='+encodeURIComponent(booking.id);
  return root+'/bookings?booking='+encodeURIComponent(booking.id);
 };
 const jobUrl=base+'/b/exterior/bookings?booking='+encodeURIComponent(booking.id);
 async function copyLink(){
  try{
   await navigator.clipboard.writeText(window.location.origin+jobUrl);
   setLinkCopied(true);
  }catch{setLinkCopied(false);}
 }
 return <section className="ecjourney" id="exterior-job-continuity" aria-label="One job source and handoff overview">
  <header className="ecjourney-head">
   <div>
    <span>EXACT SOURCE BOOKING / JOB CONTINUITY</span>
    <h3>One job. One source of truth.</h3>
    <p>{shortDay(booking.date)} · {booking.time_block??'Time unverified'} · {booking.status??'Unknown booking status'}. Follow real records from customer through team work and closeout.</p>
   </div>
   <button type="button" aria-label="Close this job overview" onClick={close}><X size={17}/></button>
  </header>
  <div className="ecjourney-meta">
   <span><ShieldAlert size={14}/>{view.sourceCoverage==='complete'?'Original customer and booking counts reported complete':'Source history incomplete; totals and quote attribution are limited'}</span>
   <span>{mode==='preview'?'FICTIONAL / READ ONLY':'AUTHORIZED SOURCE ONLY'}</span>
  </div>
  <div className="ecjourney-steps">
   {view.steps.map((step,index)=><section key={step.key} className="ecjourney-step" data-evidence={step.evidence}>
    <div className="ecjourney-step-heading"><span className="ecjourney-number">{String(index+1).padStart(2,'0')}</span>
     <div><h4>{step.title}</h4><small title={tags[step.evidence].help}>{tags[step.evidence].text}</small></div>
    </div>
    <p>{step.detail}</p>
    <Link href={routeFor(step)}>{step.route==='finance'?'Review accounting context':step.route==='field'?'Open private field log':step.route==='customer'?'Open original customer':step.route==='estimate'?'Open estimator':'Open original booking'} <ArrowRight size={14}/></Link>
   </section>)}
  </div>
  <section className="ecjourney-team" aria-label="Current shared team actions on this job">
   <div className="ecjourney-team-top">
    <div><span>REAL COMPANY WORK / EXACT ORIGINAL BOOKING</span>
     <h4><UsersRound size={19}/> Assign. Work. Report back.</h4>
     <p>Both founders use the same authenticated company action record. The next step and progress comments stay with this booked job, not in a separate private field packet.</p>
    </div>
    {liveAccess&&<button type="button" disabled={loading} onClick={()=>setAttempt(n=>n+1)}>
     <RefreshCw size={14}/> Refresh shared actions
    </button>}
   </div>
   {mode==='preview'?<p className="ecjourney-coverage">Fictional preview: no company tasks were read or changed.</p>:
    readOnly?<p className="ecjourney-coverage">This account does not have permission to view booking-linked company tasks. No private company work was retrieved.</p>:
    !view.sourceLinked?<p className="ecjourney-alert"><AlertTriangle size={16}/> Original customer/booking link is missing. The team board was not queried.</p>:
    loading?<p className="ecjourney-coverage" role="status">Loading authenticated job assignments and progress…</p>:
    failed?<p className="ecjourney-alert" role="alert"><AlertTriangle size={16}/>{failed} Shared progress is unavailable, not zero.</p>:
    !report?<p className="ecjourney-coverage">The company task source has not loaded. No assignments or task results have been inferred.</p>:
    !matchesSource?<p className="ecjourney-alert" role="alert"><AlertTriangle size={16}/> The original booking changed since this page loaded. Refresh Jobs & Bookings before assigning or updating any team tasks.</p>:
    <ExteriorJobActionLoop
     key={booking.id} org={org} booking={booking} leadId={leadId} base={base}
     board={report} onRefresh={()=>setAttempt(n=>n+1)}
    />}
  </section>
  <footer className="ecjourney-bottom">
   <button type="button" onClick={()=>void copyLink()}><ClipboardList size={15}/>{linkCopied?'Job link copied':'Copy this exact job link'}</button>
   <small>Link opens the same booking on another authorized device; it does not share local estimates or field evidence. A reader without current organization access cannot use the link to bypass permissions.</small>
  </footer>
  <ExteriorDeviceReleaseProof mode={mode}/>
  <p className="ecjourney-note"><CheckCircle2 size={14}/> Project-stage labels describe evidence that has actually been loaded. A booking date does not certify completed work; a finished team task does not close the booking; a quote is not revenue; unknown costs or paid amounts are never treated as zero.</p>
 </section>;
}
