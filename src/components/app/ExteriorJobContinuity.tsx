'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,CheckCircle2,ClipboardList,RefreshCw,ShieldAlert,UsersRound,X} from 'lucide-react';
import type {ExtBooking,ExteriorData} from '@/lib/exterior';
import {buildJobContinuity,type JobContinuityEvidence} from '@/lib/exterior-job-continuity';
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
  const onSaved=()=>setAttempt(n=>n+1);
  window.addEventListener('oj-exterior-followup-saved',onSaved);
  return()=>window.removeEventListener('oj-exterior-followup-saved',onSaved);
 },[liveAccess]);
 const matchesSource=!!report&&report.source.date===booking.date&&
  report.source.time===booking.time_block&&report.source.status===booking.status;
 const active=report?.tasks.filter(x=>x.stage!=='Done')??[];
 const verifiedTasks=!!report&&matchesSource&&!report.limited;
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
    <div><span>LIVE COMPANY BOARD / EXACT JOB</span>
     <h4><UsersRound size={19}/> Team handoffs and next actions</h4>
     <p>These alone are synced between authorized founders. They are not a signed field report, crew dispatch, final job completion or customer payment.</p>
    </div>
    {liveAccess&&<button type="button" disabled={loading} onClick={()=>setAttempt(n=>n+1)}>
     <RefreshCw size={14}/> Refresh shared tasks
    </button>}
   </div>
   {mode==='preview'?<p className="ecjourney-coverage">Fictional preview: no company task request is sent.</p>:
    readOnly?<p className="ecjourney-coverage">A member role is needed to inspect booking-linked operational tasks. No hidden team data are assumed.</p>:
    !view.sourceLinked?<p className="ecjourney-alert"><AlertTriangle size={16}/> Original customer and booking are not linked in the loaded source. The team board was not queried.</p>:
    loading?<p className="ecjourney-coverage" role="status">Checking authenticated, booking-specific shared tasks…</p>:
    failed?<p className="ecjourney-alert" role="alert"><AlertTriangle size={16}/>{failed} Counts and task state are unknown.</p>:
    !report?<p className="ecjourney-coverage">Team task state is not loaded. This is not evidence that zero tasks exist.</p>:
    !matchesSource?<p className="ecjourney-alert" role="alert"><AlertTriangle size={16}/> This booking changed since the original schedule was loaded. Refresh the bookings source before relying on team action status.</p>:
    <>
     <div className="ecjourney-team-summary">
      <strong>{report.limited?'At least '+active.length:active.length} open job task{active.length===1?'':'s'}</strong>
      <small>{report.limited?'Task listing is truncated at 100: do not treat the count as complete.':
       'Loaded directly from the protected existing OJ company task board.'}</small>
     </div>
     {active.length?
       <ul>{active.slice(0,5).map(t=><li key={t.id}>
         <div><strong>{t.assignee}</strong><span>{t.stage} · {t.dueDate?'Due '+shortDay(t.dueDate):'Due date not recorded'} · {t.priority} priority</span></div>
         <p>{t.note}</p>
        </li>)}</ul>:
       <p className="ecjourney-coverage">{verifiedTasks?'No active booking-linked company actions have been published. Use Dispatch Preflight to assign a real follow-up.':'No active task is shown in this partial task window. Absence has not been proved.'}</p>}
     <Link href={base+'/b/exterior'}>Open founder Operations Inbox <ArrowRight size={14}/></Link>
    </>}
  </section>
  <footer className="ecjourney-bottom">
   <button type="button" onClick={()=>void copyLink()}><ClipboardList size={15}/>{linkCopied?'Job link copied':'Copy this exact job link'}</button>
   <small>Link opens the same booking on another authorized device; it does not share local estimates or field evidence. A reader without current organization access cannot use the link to bypass permissions.</small>
  </footer>
  <p className="ecjourney-note"><CheckCircle2 size={14}/> Project-stage labels describe evidence that has actually been loaded. A booking date does not certify completed work; a finished team task does not close the booking; a quote is not revenue; unknown costs or paid amounts are never treated as zero.</p>
 </section>;
}
