'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {
 AlertTriangle,ArrowRight,ArrowUpRight,CalendarClock,CheckCircle2,
 ClipboardList,Clock3,MapPin,Phone,ShieldAlert,UsersRound,
} from 'lucide-react';
import type {ExteriorData} from '@/lib/exterior';
import {businessDay} from '@/lib/reporting';
import {eligibleDispatchAssignment} from '@/lib/exterior-dispatch-delegation';
import {ExteriorDispatchAssignment} from './ExteriorDispatchAssignment';
import {
 buildDispatchPreflight,type DispatchFinding,type DispatchPreflightRow,
} from '@/lib/exterior-dispatch-preflight';

type Props={
 data:ExteriorData;now:Date;base:string;mode:'preview'|'live';org:string;readOnly:boolean;compact?:boolean;
};
type WindowChoice='today'|'week'|'two-weeks';
type IssueFilter='action'|'all';
const rangeDays:Record<WindowChoice,number>={today:0,week:7,'two-weeks':14};
const money=(n:number|null)=>n===null?'Withheld':
 new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const day=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const statusName=(s:string)=>s==='confirmed'?'Confirmed':s==='pending_approval'?'Approval pending':s;
const destination=(root:string,r:DispatchPreflightRow,flag:DispatchFinding)=>{
 if(flag.destination==='customer'&&r.leadId)return root+'/customer?lead='+encodeURIComponent(r.leadId);
 if(flag.destination==='estimate'&&r.leadId)return root+'/estimate?lead='+encodeURIComponent(r.leadId);
 if(flag.destination==='field')return root+'/field?booking='+encodeURIComponent(r.id);
 return root+'/bookings';
};
/**
 * Real authenticated source records are passed from the containing business
 * route. A missing lead, time, phone, safety certificate or source total is
 * never inferred. No writes, automatic customer messages or payroll claims.
 */
export function ExteriorDispatchPreflight({data,now,base,mode,org,readOnly,compact=false}:Props){
 const [windowChoice,setWindowChoice]=useState<WindowChoice>('week');
 const [filter,setFilter]=useState<IssueFilter>('action');
 const [assignment,setAssignment]=useState<{bookingId:string;issueCode:string}|null>(null);
 const today=businessDay(now.toISOString());
 const report=useMemo(()=>today?buildDispatchPreflight(data,today,rangeDays[windowChoice]):null,[
  data,today,windowChoice,
 ]);
 const root=base+'/b/exterior';
 if(!report)return <section className="ecdispatch" role="alert">
  Source business date is unavailable. No dispatch or quoted values were calculated.
 </section>;
 const shown=report.rows.filter(r=>filter==='all'||r.findings.length>0);
 const rows=compact?shown.slice(0,3):shown.slice(0,30);
 const blockers=report.rows.filter(r=>r.findings.some(f=>f.level==='blocker')).length;
 const coverageMessage=report.sourceComplete?
  'Loaded booking and customer counts match the reported source totals. This is not an independent field or customer confirmation.':
  'A complete customer/booking history was NOT proven. Missing links and visit prices must be verified in the original source.';
 return <section className="ecdispatch" aria-label="Source-verified dispatch preflight" id={compact?'ecdispatch-summary':'ecdispatch-operations'}>
  <header className="ecdispatch-heading">
   <div><span className="ecdispatch-eyebrow">DISPATCH / SOURCE-BASED PREFLIGHT</span>
    <h2>{compact?'Before crews roll out':'See what could disrupt the next job.'}</h2>
    <p>Review confirmed work, pending approval, site contact, time collisions and quote attribution. No crew readiness, completion or cash is assumed.</p>
   </div>
   <Link href={root+'/bookings'} className="ecdispatch-heading-link">
    {compact?'Open full dispatch':'Booking workbench'} <ArrowUpRight size={15}/>
   </Link>
  </header>
  <div className="ecdispatch-metrics" aria-label="Source-qualified upcoming booking analysis">
   {[
    {name:'Scheduled records',value:String(report.counts.upcoming),sub:'Including pending approval',tone:'normal'},
    {name:'Requires source review',value:String(report.counts.attention),sub:report.counts.blocked+' with blocking gaps',tone:report.counts.blocked?'warning':'normal'},
    {name:'Overlapping windows',value:String(report.counts.overlaps),sub:'Capacity caution, not proof of conflict',tone:report.counts.overlaps?'warning':'normal'},
    {name:'Attributable quoted work',value:money(report.price.total),sub:report.price.eligible+' of '+report.price.confirmed+' confirmed visits source-qualified',tone:report.price.total===null?'unknown':'normal'},
   ].map(m=><div className="ecdispatch-metric" data-tone={m.tone} key={m.name}>
     <span>{m.name}</span><strong>{m.value}</strong><small>{m.sub}</small>
    </div>)}
  </div>
  <div className="ecdispatch-toolbar">
   <div role="group" aria-label="Dispatch planning range" className="ecdispatch-segments">
    {([['today','Today'],['week','Next 7 days'],['two-weeks','Next 14 days']] as const)
     .map(([key,name])=><button type="button" key={key} aria-pressed={windowChoice===key}
      onClick={()=>setWindowChoice(key)}>{name}</button>)}
   </div>
   <div role="group" aria-label="Dispatch exception filter" className="ecdispatch-segments">
    <button type="button" aria-pressed={filter==='action'} onClick={()=>setFilter('action')}>Needs review</button>
    <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All jobs</button>
   </div>
  </div>
  {!report.sourceComplete&&<div className="ecdispatch-coverage" role="status">
   <ShieldAlert size={16}/><span>{coverageMessage}</span>
  </div>}
  {mode==='preview'&&<p className="ecdispatch-preview">Fictional preview records only. Live customers and booking actions are not available here.</p>}
  <div className="ecdispatch-list" aria-label="Booking readiness by source" aria-live="polite">
   {rows.map(r=>{
    const hard=r.findings.filter(f=>f.level==='blocker');
    const soft=r.findings.filter(f=>f.level==='attention');
    const booking=data.bookings.find(b=>b.id===r.id);
    const lead=data.leads.find(l=>l.id===r.leadId);
    const canAssign=mode==='live'&&!readOnly&&eligibleDispatchAssignment(r,booking,lead);
    return <article key={r.id} className="ecdispatch-job" data-severity={hard.length?'blocker':soft.length?'attention':'reviewed'}>
     <div className="ecdispatch-job-left">
      <div className="ecdispatch-job-time">
       <CalendarClock size={17}/><strong>{day(r.date)}</strong><small>{r.time}</small>
      </div>
      <div className="ecdispatch-job-context">
       <div className="ecdispatch-job-title"><h3>{r.customer}</h3>
        <span className="ecdispatch-source-status">{statusName(r.status)}</span></div>
       <p>{r.service}</p>
       {r.address?<span><MapPin size={12}/>{r.address}</span>:<span><MapPin size={12}/>Site address not recorded</span>}
       <small>Original lead quote for this visit: {money(r.quotedVisitAmount)} · no acceptance or payment inferred</small>
      </div>
     </div>
     <div className="ecdispatch-job-right">
      <div className="ecdispatch-job-diagnosis">
       {r.findings.length===0?<div className="ecdispatch-clear"><CheckCircle2 size={16}/> No source-field gaps detected. Physical readiness unverified.</div>:
        <>
         {hard.length>0&&<strong className="ecdispatch-risk"><ShieldAlert size={14}/>{hard.length} blocking review item{hard.length===1?'':'s'}</strong>}
         {soft.length>0&&<strong className="ecdispatch-caution"><AlertTriangle size={14}/>{soft.length} attention item{soft.length===1?'':'s'}</strong>}
         <ul>{r.findings.slice(0,compact?2:8).map(f=><li key={f.code}>
          <span>{f.label}</span>
          <Link href={destination(root,r,f)} aria-label={'Review '+f.label}>Review <ArrowRight size={12}/></Link>
         </li>)}</ul>
         {compact&&r.findings.length>2&&<small>{r.findings.length-2} further items in full dispatch</small>}
        </>}
      </div>
      <div className="ecdispatch-actions">
       <Link href={root+'/field?booking='+encodeURIComponent(r.id)}><ClipboardList size={14}/> Field sheet</Link>
       {r.leadId&&<Link href={root+'/customer?lead='+encodeURIComponent(r.leadId)}>Customer <ArrowUpRight size={13}/></Link>}
       {r.phone&&mode==='live'&&<a href={'tel:'+r.phone}><Phone size={14}/> Call</a>}
       {canAssign&&<button type="button" className="ecdispatch-assign-btn"
        aria-expanded={assignment?.bookingId===r.id}
        aria-label={'Assign source review for '+r.customer}
        onClick={()=>setAssignment(prev=>prev?.bookingId===r.id?null:{bookingId:r.id,issueCode:r.findings[0].code})}>
        <UsersRound size={14}/> {assignment?.bookingId===r.id?'Close assignment':'Assign action'}
       </button>}
      </div>
     </div>
     {assignment?.bookingId===r.id&&canAssign&&<ExteriorDispatchAssignment
      key={r.id} org={org} row={r} booking={booking} lead={lead} base={base}
      today={report.today} readOnly={readOnly} selectedIssue={assignment.issueCode}
      onClose={()=>setAssignment(null)}/>} 
    </article>;
   })}
   {!shown.length&&<div className="ecdispatch-empty"><Clock3 size={20}/>
    <strong>{report.rows.length===0?'No upcoming source bookings in this window.':'No flagged bookings in this window.'}</strong>
    <p>{report.rows.length===0?'Open booking workbench to schedule a job. No work or revenue was fabricated.':
     'The loaded fields do not currently show an exception. Crew readiness and site access remain unverified.'}</p>
   </div>}
   {compact&&shown.length>3&&<Link className="ecdispatch-more" href={root+'/bookings'}>
    Review {shown.length-3} more flagged jobs in Operations <ArrowRight size={14}/></Link>}
   {!compact&&shown.length>30&&<p className="ecdispatch-limit">First 30 jobs shown. Narrow the window or inspect the full booking workbench to review remaining records.</p>}
  </div>
  <footer className="ecdispatch-footer">
   <span>{report.counts.confirmed} confirmed source bookings • {report.counts.pending} awaiting approval • planning through {day(report.through)}</span>
   <span>Source counts: {data.coverage?.bookings.loaded??'Unknown'} bookings loaded / {data.coverage?.bookings.total??'Unknown'} total; {data.coverage?.leads.loaded??'Unknown'} leads loaded / {data.coverage?.leads.total??'Unknown'} total. Crew, vehicle and insurance readiness are not verified.</span>
  </footer>
 </section>;
}
