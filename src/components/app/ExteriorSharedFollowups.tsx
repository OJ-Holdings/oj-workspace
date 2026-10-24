'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {
 AlertTriangle,ArrowRight,CheckCircle2,ClipboardCheck,
 MessageSquarePlus,RefreshCw,ShieldCheck,UsersRound,
} from 'lucide-react';
import type {ExtBooking,ExtLead} from '@/lib/exterior';
import type {FieldHandoffReply} from '@/lib/exterior-crew-handoff';
import type {
 FollowupOrigin,FollowupStage,SharedJobFollowup,
} from '@/lib/exterior-job-followup';
import {actionableJobStatus,allowedFollowupStages} from '@/lib/exterior-job-followup';
import {originalJobMatchesTask} from '@/lib/exterior-operations-inbox';
import {
 addExteriorSharedFollowupNote,createExteriorSharedFollowup,
 loadExteriorSharedFollowups,updateExteriorSharedFollowupStage,
} from '@/app/workspace/exterior-followup-actions';

type Props={
 org:string;booking:ExtBooking;lead:ExtLead;base:string;
 mode:'live'|'preview';readOnly:boolean;ownerReply:FieldHandoffReply|null;
};
type Loaded=Extract<Awaited<ReturnType<typeof loadExteriorSharedFollowups>>,{ok:true}>;
const moment=(v:string)=>{
 if(!v)return 'Timestamp unavailable';
 try{return new Date(v).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});}
 catch{return 'Timestamp unavailable';}
};
const readable=(s:string)=>s==='Ready'?'To do':s==='In progress'?'Working':s==='Review'?'Awaiting review':s==='Done'?'Task done':s;
const taskSourceCurrent=(t:SharedJobFollowup,b:ExtBooking)=>originalJobMatchesTask(t,b);
export function ExteriorSharedFollowups({
 org,booking,lead,base,mode,readOnly,ownerReply,
}:Props){
 const available=mode==='live'&&!readOnly;
 const [loaded,setLoaded]=useState<Loaded|null>(null);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [draft,setDraft]=useState('');
 const [assignee,setAssignee]=useState('');
 const [dueOn,setDueOn]=useState('');
 const [priority,setPriority]=useState<'normal'|'high'>('normal');
 const [fromReply,setFromReply]=useState(false);
 const [commentDrafts,setCommentDrafts]=useState<Record<string,string>>({});
 const pendingId=useRef<string|null>(null);
 const reply=ownerReply?.decision==='follow-up-needed'&&
  ownerReply.booking_id===booking.id&&ownerReply.lead_id===lead.id&&
  ownerReply.organization_id===org?ownerReply:null;
 const [reload,setReload]=useState(0);

 useEffect(()=>{
  setLoaded(null);setError('');setNotice('');setLoading(false);
  setAssignee('');setDraft('');setDueOn('');setPriority('normal');
  setFromReply(false);setCommentDrafts({});pendingId.current=null;
 },[org,booking.id,lead.id]);

 useEffect(()=>{
  if(!available)return;
  let active=true;
  setLoading(true);setError('');
  loadExteriorSharedFollowups(org,booking.id,lead.id).then(result=>{
   if(!active)return;
   if(result.ok)setLoaded(result);
   else {setLoaded(null);setError(result.reason);}
  },()=>{
   if(active){setLoaded(null);setError('Shared board could not be reached. Nothing was substituted locally.');}
  }).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[available,org,booking.id,lead.id,reload]);

 useEffect(()=>{
  if(!reply)return;
  setDraft(reply.note);setDueOn(reply.due_on??'');setPriority('normal');
  setFromReply(true);pendingId.current=null;
 },[reply?.request_id,reply?.replied_at]); // eslint-disable-line react-hooks/exhaustive-deps

 const publish=async()=>{
  if(!available||!loaded||busy||loaded.limited||sharedSourceChanged)return;
  const useReply=fromReply&&reply;
  const note=draft.trim();
  if(note.length<10||note.length>1200){setError('Describe an exact next action (10–1200 characters).');return;}
  if(!assignee||!loaded.members.some(m=>m.name===assignee)){
   setError('Assign this to an active company member before publishing.');return;
  }
  if(!window.confirm(
   'Publish an INTERNAL, BOOKING-LINKED company task visible to workspace members? '+
   'Do NOT include private field costs, customer financial details, passwords or confidential notes. '+
   'This does not automatically message anyone or approve completed work.'
  ))return;
  setBusy(true);setError('');setNotice('');
  try{
   let taskId:string;
   if(useReply)taskId=reply.request_id;
   else{
    if(!pendingId.current){
     if(typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')
      throw Error('Secure task identifier is unavailable on this device.');
     pendingId.current=crypto.randomUUID();
    }
    taskId=pendingId.current;
   }
   const origin:FollowupOrigin=useReply?'private-owner-reply-reference':'manual-job-task';
   const saved=await createExteriorSharedFollowup(org,booking.id,{
    taskId,sourceDate:booking.date,sourceTime:booking.time_block,
    sourceStatus:booking.status,leadId:lead.id,
    assignee,note,dueOn,priority,origin,
    handoffRequestId:useReply?reply.request_id:null,
   });
   setLoaded(v=>v?{...v,tasks:[saved,...v.tasks.filter(t=>t.id!==saved.id)]}:v);
   setNotice('Saved on the shared company task board. Authorized founders can open this job or the task board on another device to see it after refreshing.');
   pendingId.current=null;
   if(!useReply){setDraft('');setDueOn('');setPriority('normal');}
  }catch(e){setError(e instanceof Error?e.message:'Could not save this shared action.');}
  finally{setBusy(false);}
 };
 const updateStage=async(task:SharedJobFollowup,next:FollowupStage)=>{
  if(!available||busy||next===task.stage||sharedSourceChanged||
    !taskSourceCurrent(task,booking))return;
  if(next==='Done'&&!window.confirm(
   'Mark the COMPANY FOLLOW-UP TASK done? This does not complete the original job, approve any quote, certify payroll or record customer payment.'
  ))return;
  setBusy(true);setError('');setNotice('');
  try{
   const saved=await updateExteriorSharedFollowupStage(org,booking.id,lead.id,task.id,task.revision,next);
   setLoaded(v=>v?{...v,tasks:v.tasks.map(t=>t.id===task.id?saved:t)}:v);
   setNotice('Shared task updated. The original booking and local field worksheet were not changed.');
  }catch(e){setError(e instanceof Error?e.message:'Task update did not save; refresh the shared board.');}
  finally{setBusy(false);}
 };
 const addNote=async(task:SharedJobFollowup)=>{
  const body=commentDrafts[task.id]?.trim()??'';
  if(!available||busy||sharedSourceChanged||!taskSourceCurrent(task,booking)||
    body.length<3||body.length>600)return;
  setBusy(true);setError('');setNotice('');
  try{
   const saved=await addExteriorSharedFollowupNote(org,booking.id,lead.id,task.id,body);
   setLoaded(v=>v?{...v,notes:[saved,...v.notes]}:v);
   setCommentDrafts(v=>({...v,[task.id]:''}));
   setNotice('Update posted to the shared company board. It does not modify the booking or field log.');
  }catch(e){setError(e instanceof Error?e.message:'The note was not saved.');}
  finally{setBusy(false);}
 };
 const status=loaded?.tasks??[];
 const active=status.filter(t=>t.stage!=='Done');
 const finished=status.filter(t=>t.stage==='Done');
 const all=[...active,...finished];
 const alreadyPublished=Boolean(fromReply&&reply&&status.some(t=>
  t.origin==='private-owner-reply-reference'&&t.handoffRequestId===reply.request_id));
 const sharedSourceChanged=Boolean(loaded&&(
  loaded.source.date!==booking.date||loaded.source.time!==booking.time_block||
  loaded.source.status!==booking.status||!actionableJobStatus(booking.status)));

 return <section className="ecfield-shared" aria-label="Shared company job follow-ups" id="ecfield-shared">
  <header className="ecfield-shared-head">
   <div>
    <span className="ecfield-overline">13 / VERIFIED COMPANY TASK BOARD</span>
    <h2>Shared follow-ups. Same job, both founders.</h2>
    <p>Assign and update small job-specific actions on the existing member-protected company board. Unlike private JSON field reports, these tasks persist for authorized teammates on other devices.</p>
   </div>
   <div className="ecfield-shared-badge"><ShieldCheck size={17}/>
    <span>Shared task records<small>Not synced field evidence</small></span>
   </div>
  </header>
  {!available&&<p className="ecfield-shared-warning">Preview or read-only mode: no shared company records were requested and task writes are disabled.</p>}
  {available&&<div className="ecfield-shared-toolbar">
   <div><strong>{loading?'Checking live source…':loaded?active.length+' active follow-up'+(active.length===1?'':'s'):'Shared board unavailable'}</strong>
    <span>{loaded?finished.length+' task(s) marked done · linked to this original booking':'No demonstration data is shown when the real source is unavailable.'}</span></div>
   <button type="button" onClick={()=>setReload(x=>x+1)} disabled={busy||loading}>
    <RefreshCw size={15}/> Refresh from company board
   </button>
  </div>}
  {error&&<p className="ecfield-shared-warning" role="alert"><AlertTriangle size={16}/>{error}</p>}
  {notice&&<p className="ecfield-shared-notice" role="status"><CheckCircle2 size={16}/>{notice}</p>}
  {loaded?.notesLimited&&<p className="ecfield-shared-warning">The latest 200 company task comments may not include older progress. This is a partial comment history.</p>}
  {loaded?.limited&&<p className="ecfield-shared-warning">The matching board query exceeded 100 source tasks. This view is partial; use the full company task board to inspect history.</p>}
  {sharedSourceChanged&&<p className="ecfield-shared-warning"><AlertTriangle size={16}/>The original booking is not in a supported active state or this field screen is stale. Reload the original job before changing linked tasks.</p>}
  {loaded&&<>
   <div className="ecfield-shared-layout">
    <div className="ecfield-shared-compose">
     <div className="ecfield-shared-section-title"><MessageSquarePlus size={17}/><h3>Assign next action</h3></div>
     {reply&&<div className="ecfield-shared-reply">
      <span>Locally prepared owner follow-up exists</span>
      <p>This private packet contains a follow-up note, but the reviewer label is self-entered. Publishing this task will attribute the company write to your actual signed-in session—not certify the local reviewer identity.</p>
      <label><input type="checkbox" checked={fromReply} disabled={busy}
       onChange={e=>{setFromReply(e.target.checked);pendingId.current=null;
        if(e.target.checked){setDraft(reply.note);setDueOn(reply.due_on??'');}
        else{setDraft('');setDueOn('');}
       }}/>
       Use the prepared private owner follow-up
      </label>
      {alreadyPublished&&<span className="ecfield-shared-published"><CheckCircle2 size={15}/> This handoff request already has a linked company task.</span>}
     </div>}
     <label>What exactly must happen next?
      <textarea rows={4} disabled={!available||busy||sharedSourceChanged}
       maxLength={1200} value={draft} onChange={e=>setDraft(e.target.value)}
       placeholder="Example: Confirm water access with the customer before Monday, then report back."/>
     </label>
     <div className="ecfield-shared-form-row">
      <label>Responsible company member
       <select value={assignee} disabled={!available||busy||sharedSourceChanged}
        onChange={e=>setAssignee(e.target.value)}>
        <option value="">Choose teammate…</option>
        {loaded.members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}
       </select>
      </label>
      <label>Target date (optional)
       <input type="date" disabled={!available||busy||sharedSourceChanged}
        value={dueOn} onChange={e=>setDueOn(e.target.value)}/>
      </label>
      <label>Priority
       <select disabled={!available||busy||sharedSourceChanged} value={priority}
        onChange={e=>setPriority(e.target.value as 'normal'|'high')}>
        <option value="normal">Normal</option><option value="high">High attention</option>
       </select>
      </label>
     </div>
     <button className="ecfield-shared-primary" type="button" onClick={publish}
      disabled={!available||busy||sharedSourceChanged||loaded.limited||loading||!assignee||draft.trim().length<10||alreadyPublished}>
      <ClipboardCheck size={16}/>{busy?'Saving shared task…':'Publish company follow-up'}<ArrowRight size={15}/>
     </button>
     <small>Published tasks appear on the existing organization board. No automatic SMS, email, customer update, quote acceptance or job closeout occurs.</small>
    </div>
    <div className="ecfield-shared-tasks">
     <div className="ecfield-shared-section-title"><UsersRound size={17}/><h3>Exact-job shared work</h3></div>
     {!all.length&&<div className="ecfield-shared-empty">
      <CheckCircle2 size={20}/><strong>No shared follow-ups linked to this booking yet.</strong>
      <p>This does not imply the job is complete or that the crew is prepared. The original field worksheet is still local.</p>
     </div>}
     {all.map(task=><article className="ecfield-shared-task" key={task.id} data-state={task.stage}>
      <header>
       <div><strong>{task.note}</strong><small>Assigned to {task.assignee} · {task.priority==='high'?'High attention':'Normal'}</small></div>
       <span>{readable(task.stage)}</span>
      </header>
      <div className="ecfield-shared-task-meta">
       <span>Created {moment(task.createdAt)}</span>
       {task.dueDate&&<span>Target {task.dueDate}</span>}
       <span>{task.origin==='private-owner-reply-reference'?'References a local private handoff':'Direct company task'}</span>
      </div>
      {!taskSourceCurrent(task,booking)&&<p className="ecfield-shared-warning">Booking date, time or status changed since this task was created. Verify current source before acting.</p>}
      <div className="ecfield-shared-task-actions">
       <label>Company task status
        <select value={task.stage} disabled={!available||busy||loading||sharedSourceChanged||!taskSourceCurrent(task,booking)}
         onChange={e=>{void updateStage(task,e.target.value as FollowupStage);}}>
         {allowedFollowupStages.map(stage=><option key={stage} value={stage}>{readable(stage)}</option>)}
        </select>
       </label>
       <Link href={base+'/tasks'}>Open company board <ArrowRight size={13}/></Link>
      </div>
      <div className="ecfield-shared-task-notes">
       {loaded.notes.filter(n=>n.taskId===task.id).slice(0,6).map(n=><p key={n.id}>
        <strong>{n.author}</strong><small>{moment(n.createdAt)}</small><span>{n.body}</span>
       </p>)}
       <div><input type="text" maxLength={600} aria-label={'Add shared progress note for '+task.assignee}
        placeholder="Post a concise progress update…"
        disabled={!available||busy||sharedSourceChanged||!taskSourceCurrent(task,booking)} value={commentDrafts[task.id]??''}
        onChange={e=>setCommentDrafts(v=>({...v,[task.id]:e.target.value}))}/>
        <button type="button" disabled={!available||busy||sharedSourceChanged||!taskSourceCurrent(task,booking)||(commentDrafts[task.id]?.trim().length??0)<3}
         onClick={()=>{void addNote(task);}}>Post</button></div>
      </div>
     </article>)}
    </div>
   </div>
   <footer className="ecfield-shared-footer">These are member-visible, editable company task notes on the existing \`oj_cards\`/\`oj_comments\` board, not protected field or financial evidence. A completed task is not a completed booking or payment. The source IDs are checked by the server before writes; descriptions are still editable by authorized members.</footer>
  </>}
 </section>;
}
