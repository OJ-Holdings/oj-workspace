'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,CheckCircle2,ClipboardCheck,RefreshCw,ShieldCheck,UsersRound,X} from 'lucide-react';
import type {DispatchPreflightRow} from '@/lib/exterior-dispatch-preflight';
import type {ExtBooking,ExtLead} from '@/lib/exterior';
import {
 dispatchAssignmentDueDay,dispatchAssignmentOptions,dispatchAssignmentPriority,
 eligibleDispatchAssignment,suggestDispatchAssignment,
} from '@/lib/exterior-dispatch-delegation';
import {
 createExteriorSharedFollowup,loadExteriorSharedFollowups,
} from '@/app/workspace/exterior-followup-actions';

type Props={
 org:string;row:DispatchPreflightRow;booking:ExtBooking|undefined;
 lead:ExtLead|undefined;base:string;today:string;readOnly:boolean;
 selectedIssue:string;onClose:()=>void;
};
type Loaded=Extract<Awaited<ReturnType<typeof loadExteriorSharedFollowups>>,{ok:true}>;
export function ExteriorDispatchAssignment({
 org,row,booking,lead,base,today,readOnly,selectedIssue,onClose,
}:Props){
 const options=dispatchAssignmentOptions(row);
 const [issue,setIssue]=useState(selectedIssue);
 const [note,setNote]=useState(suggestDispatchAssignment(row,selectedIssue)??'');
 const [assignee,setAssignee]=useState('');
 const [due,setDue]=useState(dispatchAssignmentDueDay(row,selectedIssue,today));
 const [priority,setPriority]=useState<'normal'|'high'>(dispatchAssignmentPriority(row,selectedIssue));
 const [loaded,setLoaded]=useState<Loaded|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [reload,setReload]=useState(0);
 const taskId=useRef<string|null>(null);
 const available=!readOnly&&eligibleDispatchAssignment(row,booking,lead);
 const leadId=lead?.id??'';
 const bookingId=booking?.id??'';
 useEffect(()=>{
  setIssue(selectedIssue);
  setNote(suggestDispatchAssignment(row,selectedIssue)??'');
  setDue(dispatchAssignmentDueDay(row,selectedIssue,today));
  setPriority(dispatchAssignmentPriority(row,selectedIssue));
  setAssignee('');setLoaded(null);setError('');setSuccess('');
  taskId.current=null;
 },[org,bookingId,leadId,selectedIssue,today]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(!available){setLoaded(null);return;}
  let current=true;setLoading(true);
  loadExteriorSharedFollowups(org,bookingId,leadId).then(result=>{
   if(!current)return;
   if(result.ok){setLoaded(result);setError('');}
   else{setLoaded(null);setError(result.reason);}
  },()=>{if(current){setLoaded(null);setError('Shared company board unavailable; no task was fabricated.');}})
  .finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;};
 },[available,org,bookingId,leadId,reload]);
 const snapshotMatches=!!loaded&&!!booking&&
   loaded.source.date===booking.date&&loaded.source.time===booking.time_block&&
   loaded.source.status===booking.status;
 const outstanding=loaded?.tasks.filter(t=>t.stage!=='Done')??[];
 const same=outstanding.find(t=>t.note===note.trim());
 const changeIssue=(code:string)=>{
  setIssue(code);setNote(suggestDispatchAssignment(row,code)??'');
  setDue(dispatchAssignmentDueDay(row,code,today));
  setPriority(dispatchAssignmentPriority(row,code));
  taskId.current=null;setSuccess('');setError('');
 };
 const publish=async()=>{
  if(!available||!booking||!lead||!loaded||!snapshotMatches||busy||loading||same)return;
  if(!loaded.members.some(m=>m.name===assignee)){
   setError('Choose an actual, uniquely named active company member.');return;
  }
  if(note.trim().length<10||note.length>1200){
   setError('Write a specific internal instruction between 10 and 1200 characters.');return;
  }
  if(!window.confirm(
   'Create an INTERNAL COMPANY TASK for this exact booking? This is visible to authorized team members. '+
   'No customer messages are sent, no employee/vehicle capacity is reserved and no quote, job or payment is approved. '+
   'Keep private customer details and crew costs out of the shared task text.'
  ))return;
  setBusy(true);setError('');setSuccess('');
  try{
   if(!taskId.current){
    if(typeof crypto==='undefined'||!crypto.randomUUID)
     throw Error('Secure unique task IDs are not supported on this device.');
    taskId.current=crypto.randomUUID();
   }
   const result=await createExteriorSharedFollowup(org,booking.id,{
    taskId:taskId.current,leadId:lead.id,
    sourceDate:booking.date,sourceTime:booking.time_block,sourceStatus:booking.status,
    assignee,note:note.trim(),dueOn:due,priority,
    origin:'manual-job-task',handoffRequestId:null,
   });
   setLoaded(prev=>prev?{...prev,tasks:[result,...prev.tasks.filter(x=>x.id!==result.id)]}:prev);
   setSuccess('Assigned on the protected company task board. Both authorized founders can see it in the Operations Inbox on their devices after refresh.');
   taskId.current=null;
   window.dispatchEvent(new Event('oj-exterior-followup-saved'));
  }catch(e){
   setError(e instanceof Error?e.message:'No company task was saved. Verify the booking and retry.');
  }finally{setBusy(false);}
 };
 return <section className="ecdispatch-delegate" aria-label={'Delegate dispatch check for '+row.customer}>
  <header className="ecdispatch-delegate-head">
   <div><span>COMPANY WORK / EXACT BOOKING</span>
    <h4>Assign the next step</h4>
    <p>Send a specific action to a teammate. This becomes a persistent shared task—not a customer message or certified dispatch assignment.</p></div>
   <button type="button" aria-label="Close assignment desk" onClick={onClose}><X size={16}/></button>
  </header>
  {!available&&<p className="ecdispatch-delegate-warning"><AlertTriangle size={15}/>The linked booking and customer source cannot be verified. Open the original booking to resolve the source first.</p>}
  {available&&<>
   <div className="ecdispatch-delegate-toolbar">
    <div><ShieldCheck size={16}/><span>{loading?'Checking the live company board…':loaded?
     outstanding.length+' open action(s) on this booking':'The live task board has not been verified'}</span></div>
    <button type="button" onClick={()=>setReload(n=>n+1)} disabled={busy||loading}>
     <RefreshCw size={14}/> Reload tasks</button>
   </div>
   {error&&<p className="ecdispatch-delegate-warning" role="alert"><AlertTriangle size={14}/>{error}</p>}
   {success&&<p className="ecdispatch-delegate-success" role="status"><CheckCircle2 size={14}/>{success}</p>}
   {loaded?.limited&&<p className="ecdispatch-delegate-warning">The original-job task query was capped at 100 rows; duplicate checks may not include all historical records. Inspect the full company board.</p>}
   {loaded&&!snapshotMatches&&<p className="ecdispatch-delegate-warning" role="alert">
    <AlertTriangle size={15}/>The booking date, time or status has changed since your dispatch view loaded. Refresh the booking before publishing anything.
   </p>}
   <div className="ecdispatch-delegate-fields">
    <label>Dispatch issue
     <select value={issue} onChange={e=>changeIssue(e.target.value)} disabled={busy}>
      {options.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}
     </select>
    </label>
    <label className="ecdispatch-delegate-message">Specific internal action
     <textarea value={note} onChange={e=>{setNote(e.target.value);taskId.current=null;setSuccess('');}}
      maxLength={1200} rows={3} disabled={busy||!snapshotMatches}
      placeholder="Record one concrete action and ask the assignee to post the outcome…"/>
    </label>
    <label>Responsible teammate
     <select value={assignee} onChange={e=>setAssignee(e.target.value)} disabled={busy||!snapshotMatches}>
      <option value="">Select team member…</option>
      {loaded?.members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}
     </select>
    </label>
    <label>Due date
     <input type="date" value={due} onChange={e=>setDue(e.target.value)}
      disabled={busy||!snapshotMatches}/>
    </label>
    <label>Priority
     <select value={priority} onChange={e=>setPriority(e.target.value as 'normal'|'high')}
      disabled={busy||!snapshotMatches}>
      <option value="normal">Normal</option><option value="high">High attention</option>
     </select>
    </label>
   </div>
   {same&&<p className="ecdispatch-delegate-existing">
    <UsersRound size={15}/> An active company task already has this exact action.
    Assigned to {same.assignee} ({same.stage}). Review it before making another.
   </p>}
   {outstanding.length>0&&<details className="ecdispatch-delegate-history">
    <summary>{outstanding.length} other open job-specific company action(s)</summary>
    <ul>{outstanding.slice(0,6).map(t=><li key={t.id}>
     <b>{t.assignee}</b> · {t.stage} · {t.note}
    </li>)}</ul>
   </details>}
   <div className="ecdispatch-delegate-bottom">
    <button type="button" onClick={()=>{void publish();}}
     disabled={busy||loading||!loaded||!snapshotMatches||!assignee||!note.trim()||!!same}
     className="ecdispatch-delegate-publish"><ClipboardCheck size={15}/>
      {busy?'Saving shared assignment…':'Assign to teammate'} <ArrowRight size={15}/>
    </button>
    <Link href={base+'/tasks?business=exterior'}>View shared company work <ArrowRight size={13}/></Link>
   </div>
   <small className="ecdispatch-delegate-foot">Authorized members only. An assigned task is not proof of a confirmed booking, crew/vehicle availability, accepted quote, sent reminder, finished work, approved payroll or collected funds.</small>
  </>}
 </section>;
}
