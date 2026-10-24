'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {
 AlertTriangle,ArrowRight,ArrowUpRight,CalendarClock,CheckCircle2,
 ClipboardList,Clock3,RefreshCw,ShieldAlert,UsersRound,
} from 'lucide-react';
import {loadExteriorOperationsInbox,type ExteriorInboxLoad} from '@/app/workspace/exterior-inbox-actions';
import {updateExteriorSharedFollowupStage} from '@/app/workspace/exterior-followup-actions';
import {
 selectExteriorInbox,type ExteriorInboxItem,type InboxFilter,
} from '@/lib/exterior-operations-inbox';
import {allowedFollowupStages,type FollowupStage} from '@/lib/exterior-job-followup';

type Props={org:string;mode:'live'|'preview';base:string;readOnly:boolean};
const followupLabel=(s:string)=>s==='Ready'?'To do':s==='In progress'?'In progress':
 s==='Review'?'Owner review':s==='Done'?'Task done':s;
const shortDate=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-US',{
 month:'short',day:'numeric',timeZone:'America/Chicago',
});
const time=(s:string)=>new Date(s).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
type Ready=Extract<ExteriorInboxLoad,{ok:true}>;

/** A real, live company queue. Preview and read-only modes NEVER call a
 * database server action, and we never fabricate customer tasks or metrics. */
export function ExteriorOperationsInbox({org,mode,base,readOnly}:Props){
 const live=mode==='live'&&!readOnly;
 const [latest,setLatest]=useState<Ready|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [focus,setFocus]=useState<InboxFilter>('all');
 const [shown,setShown]=useState(8);
 const [reload,setReload]=useState(0);
 const [pendingTask,setPendingTask]=useState<string|null>(null);
 useEffect(()=>{setLatest(null);setError('');setNotice('');},[org,live]);
 useEffect(()=>{
  if(!live){setLatest(null);setError('');return;}
  let cancelled=false;
  setLoading(true);
  loadExteriorOperationsInbox(org).then(result=>{
   if(cancelled)return;
   if(result.ok){setLatest(result);setError('');}
   else {setLatest(null);setError(result.reason);}
  },()=>{
   if(!cancelled){setLatest(null);setError('Shared work could not be loaded; no cached company state was substituted.');}
  }).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[org,live,reload]);
 useEffect(()=>{
  if(!live)return;
  const refresh=()=>{
   if(document.visibilityState==='visible')setReload(x=>x+1);
  };
  const timer=window.setInterval(refresh,90_000);
  window.addEventListener('focus',refresh);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[live]);
 useEffect(()=>{
  if(!live)return;
  const onPublished=()=>setReload(n=>n+1);
  window.addEventListener('oj-exterior-followup-saved',onPublished);
  return()=>window.removeEventListener('oj-exterior-followup-saved',onPublished);
 },[live]);
 const report=latest?.report??null;
 const entries=useMemo(()=>report?selectExteriorInbox(report.items,focus):[],[report,focus]);
 const displayed=entries.slice(0,shown);
 const total=report?.totals;
 const switchFocus=(v:InboxFilter)=>{setFocus(v);setShown(8);};
 const stageChange=async(x:ExteriorInboxItem,stage:FollowupStage)=>{
  if(!live||busy||x.source!=='current'||x.task.stage===stage)return;
  if(stage==='Done'&&!window.confirm(
   'Mark only this SHARED FOLLOW-UP TASK done? The original booked job, field review, invoice and payment are not changed.'
  ))return;
  setPendingTask(x.task.id);setBusy(true);setError('');setNotice('');
  try{
   await updateExteriorSharedFollowupStage(
    org,x.bookingId,x.leadId,x.task.id,x.task.revision,stage,
   );
   setNotice('Company task updated; original customer booking and field records remain unchanged.');
   setReload(v=>v+1);
  }catch(e){
   setError(e instanceof Error?e.message:'Shared task update did not save; refresh and verify the source.');
   setReload(v=>v+1);
  }finally{setBusy(false);setPendingTask(null);}
 };
 const root=base+'/b/exterior';
 return <section className="ecinbox" aria-label="Founder shared operations inbox">
  <header className="ecinbox-head">
   <div>
    <span className="ecinbox-kicker">ATLAS / SHARED EXECUTION / LIVE COMPANY TASKS</span>
    <h2>Work that cannot fall between founders.</h2>
    <p>Every booking-linked assignment in one operational queue. Real member tasks, original job links, and source-change warnings—not another collection of draft notes.</p>
   </div>
   <Link href={base+'/tasks?business=exterior'} className="ecinbox-board-link">
    Company task board <ArrowUpRight size={15}/>
   </Link>
  </header>
  {!live?<div className="ecinbox-private">
   <ShieldAlert size={18}/>
   <div><strong>Company follow-ups are available in signed-in live mode.</strong>
    <p>Preview contains no invented tasks. Sign in as an authorized founder to see or update actual shared company work.</p>
   </div>
  </div>:<>
   <div className="ecinbox-stats" aria-label="Verified member-scoped work indicators">
    {[
     ['Active follow-ups',total?.active,'Existing company tasks; not jobs'],
     ['My assignments',total?.mine,report?.identity==='unique'?'Assigned to '+report.myName:'Member identity needs review'],
     ['Past due',total?.overdue,'Unfinished tasks past their date'],
     ['Owner review',total?.review,'Tasks in review, not customer approvals'],
     ['Source changed',total?.sourceChanged,'Booking changed or source unavailable'],
    ].map(([label,value,detail])=><div key={String(label)} className="ecinbox-stat">
      <small>{label}</small><strong>{value===undefined?'—':value}</strong><span>{detail}</span>
     </div>)}
   </div>
   <div className="ecinbox-toolbar">
    <div className="ecinbox-tabs" role="group" aria-label="Filter shared job work">
     {([
      ['all','Team queue',total?.visible],
      ['mine','Assigned to me',total?.mine],
      ['overdue','Overdue',total?.overdue],
      ['review','Needs review',total?.review],
      ['source-changed','Check source',total?.sourceChanged],
      ['today','Due today',total?.dueToday],
     ] as const).map(([id,label,count])=><button key={id} type="button"
      aria-pressed={focus===id} onClick={()=>switchFocus(id)}>{label}
      {typeof count==='number'&&<span>{count}</span>}</button>)}
    </div>
    <button className="ecinbox-refresh" type="button" disabled={busy||loading}
     onClick={()=>setReload(n=>n+1)}><RefreshCw size={15} className={loading?'ecinbox-spin':''}/> Refresh</button>
   </div>
   {loading&&<p className="ecinbox-status" role="status">Checking authorized company tasks and original booking sources…</p>}
   {error&&<p className="ecinbox-error" role="alert"><AlertTriangle size={16}/>{error}</p>}
   {notice&&<p className="ecinbox-success" role="status"><CheckCircle2 size={16}/>{notice}</p>}
   {report?.partial&&<div className="ecinbox-error" role="status">
    <ShieldAlert size={16}/>
    <span>Only a bounded {report.returnedCount} of {report.sourceCount??'unknown'} matching source task records were loaded. Counts and this queue may be incomplete; inspect the full company board. Nothing outside the verified window was assumed absent.</span>
   </div>}
   {report?.identity!=='unique'&&report&&<div className="ecinbox-error" role="status">
    <UsersRound size={16}/> The signed-in member name is not uniquely resolvable. Team work remains visible, but “Mine” cannot be assigned confidently.
   </div>}
   <div className="ecinbox-list" aria-live="polite">
    {displayed.map(x=>{
     const stale=x.source!=='current';
     const urgency=stale?'source':x.timing==='overdue'?'overdue':
       x.task.stage==='Review'?'review':x.timing==='today'?'today':'standard';
     return <article key={x.task.id} className="ecinbox-item" data-urgency={urgency}>
      <div className="ecinbox-item-top">
       <div className="ecinbox-identity">
        <div className="ecinbox-item-flag">
         {stale?<ShieldAlert size={16}/>:x.timing==='overdue'?<Clock3 size={16}/>:<ClipboardList size={16}/>}
         <strong>{stale?'Verify original booking':x.timing==='overdue'?'Overdue task':x.task.stage==='Review'?'Owner attention':followupLabel(x.task.stage)}</strong>
        </div>
        <h3>{x.customer}</h3>
        <p>{x.service}</p>
       </div>
       <div className="ecinbox-item-meta">
        <span>{x.task.priority==='high'?'High priority':'Normal'}</span>
        <span>{x.task.assignee||'Unassigned in company board'}</span>
        {x.task.dueDate&&<span><CalendarClock size={12}/> Due {shortDate(x.task.dueDate)}</span>}
       </div>
      </div>
      <p className="ecinbox-instruction">{x.task.note}</p>
      {stale&&<p className="ecinbox-source-note"><AlertTriangle size={14}/>{x.sourceDetail}</p>}
      <div className="ecinbox-item-bottom">
       <div className="ecinbox-actions">
        <Link href={root+'/bookings?booking='+encodeURIComponent(x.bookingId)}>
         Open job <ArrowRight size={13}/>
        </Link>
        {x.source!=='unavailable'&&<Link href={root+'/customer?lead='+encodeURIComponent(x.leadId)}>
          Customer <ArrowUpRight size={13}/>
         </Link>}
        <Link href={base+'/tasks?business=exterior'}>Company board <ArrowUpRight size={13}/></Link>
       </div>
       <label>Team task status
        <select aria-label={'Update company task for '+x.customer}
         value={x.task.stage} disabled={busy||loading||stale}
         onChange={e=>{void stageChange(x,e.target.value as FollowupStage);}}>
         {x.task.stage==='Backlog'&&<option value="Backlog">Backlog</option>}
         {allowedFollowupStages.map(s=><option value={s} key={s}>{followupLabel(s)}</option>)}
        </select>
       </label>
      </div>
      {pendingTask===x.task.id&&<small className="ecinbox-pending">Saving this task to the member-protected board…</small>}
     </article>;
    })}
    {!loading&&!error&&report&&entries.length===0&&<div className="ecinbox-empty">
     <ClipboardList size={24}/>
     <strong>{report.totals.visible===0?'No booking-linked shared tasks have been published yet.':
      focus==='mine'?'No verified assignments for this member in the current source window.':
      'No shared tasks match this filter.'}</strong>
     <p>Start at a booked job’s Field Command and publish an assigned follow-up. It will appear here for authorized team members after refresh. This is not proof every job is ready or completed.</p>
     <Link href={root+'/bookings'}>Open booked jobs <ArrowRight size={14}/></Link>
    </div>}
    {entries.length>shown&&<button type="button" className="ecinbox-more"
      onClick={()=>setShown(n=>n+8)}>Show {Math.min(8,entries.length-shown)} more tasks <ArrowRight size={14}/></button>}
   </div>
   <footer className="ecinbox-footer">
    <span>{latest?.loadedAt?'Live source checked at '+time(latest.loadedAt):'Live source not verified'}. Team tasks refresh while this app is in use; use Refresh for immediate checks.</span>
    <span>Only signed-in, RLS-protected company follow-ups. A task marked Done does not mean a completed booking, site-safety clearance, accepted quote, paid invoice or company revenue.</span>
   </footer>
  </>}
 </section>;
}
