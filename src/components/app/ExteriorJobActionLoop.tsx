'use client';

import {useRef,useState} from 'react';
import Link from 'next/link';
import {
 AlertTriangle,ArrowRight,CheckCircle2,ClipboardCheck,MessageCircle,
 MessageSquarePlus,ShieldCheck,UsersRound,
} from 'lucide-react';
import type {ExtBooking} from '@/lib/exterior';
import {
 existingOpenJobAction,linkedTaskActionable,originalBookingActionable,
 validOperatorNote,type OriginalBookingSnapshot,
} from '@/lib/exterior-job-action-loop';
import {
 allowedFollowupStages,type FollowupStage,type SharedJobFollowup,
} from '@/lib/exterior-job-followup';
import {
 addExteriorSharedFollowupNote,createExteriorSharedFollowup,
 loadExteriorSharedFollowups,updateExteriorSharedFollowupStage,
} from '@/app/workspace/exterior-followup-actions';

type Board=Extract<Awaited<ReturnType<typeof loadExteriorSharedFollowups>>,{ok:true}>;
type Props={
 org:string;booking:ExtBooking;leadId:string;base:string;
 board:Board;onRefresh:()=>void;
};
const stageLabel=(s:string)=>s==='Ready'?'To do':s==='In progress'?'Working':
 s==='Review'?'Needs owner review':s==='Done'?'Task done':s;
const moment=(v:string)=>{
 if(!v)return 'Time unavailable';
 const d=new Date(v);
 return Number.isFinite(d.getTime())?d.toLocaleString('en-US',{
  month:'short',day:'numeric',hour:'numeric',minute:'2-digit',
 }):'Time unavailable';
};
const informOtherViews=()=>{
 window.dispatchEvent(new Event('oj-exterior-followup-saved'));
};

/** R43: all writes target existing member-RLS oj_cards/oj_comments and are
 * server-validated again against the original booking+customer source.
 * This is team execution, NOT a work-order, dispatch/rig, payroll or payment.
 */
export function ExteriorJobActionLoop({org,booking,leadId,base,board,onRefresh}:Props){
 const [note,setNote]=useState('');
 const [assignee,setAssignee]=useState('');
 const [dueOn,setDueOn]=useState('');
 const [priority,setPriority]=useState<'normal'|'high'>('normal');
 const [comments,setComments]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const retryId=useRef<string|null>(null);

 const source:OriginalBookingSnapshot=board.source;
 const canWrite=originalBookingActionable(booking,source);
 const all=[...board.tasks].sort((a,b)=>
  Number(a.stage==='Done')-Number(b.stage==='Done')||
  Number(a.priority!=='high')-Number(b.priority!=='high')||
  a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id));
 const active=all.filter(t=>t.stage!=='Done');
 const duplicate=existingOpenJobAction(board.tasks,assignee,note);
 const canCreate=canWrite&&!board.limited&&!busy&&
  validOperatorNote(note,10,1200)&&board.members.some(m=>m.name===assignee)&&
  !duplicate;
 const changeIntent=()=>{retryId.current=null;setError('');setNotice('');};
 const confirmCreation=async()=>{
  if(!canCreate)return;
  if(!window.confirm(
   'Publish a company INTERNAL task to this EXACT original booking? '+
   'It will be visible to authorized members on other devices. '+
   'No customer notification is sent, and no crew/vehicle is reserved. '+
   'Do not include customer addresses, private field costs, bank details or passwords.'
  ))return;
  setBusy('create');setError('');setNotice('');
  try{
   if(!retryId.current){
    if(typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')throw Error('Secure task identifiers are not available on this device.');
    retryId.current=crypto.randomUUID();
   }
   await createExteriorSharedFollowup(org,booking.id,{
    taskId:retryId.current,
    leadId,sourceDate:booking.date,sourceTime:booking.time_block,
    sourceStatus:booking.status,
    assignee,note:note.trim(),dueOn,priority,origin:'manual-job-task',handoffRequestId:null,
   });
   retryId.current=null;setNote('');setDueOn('');setPriority('normal');
   setNotice('Shared company assignment saved. Other members can see it after refreshing.');
   informOtherViews();
  }catch(e){
   setError(e instanceof Error?e.message:'Task was not saved; check the company board and retry.');
  }finally{setBusy(null);}
 };
 const changeStage=async(task:SharedJobFollowup,stage:FollowupStage)=>{
  if(busy||!linkedTaskActionable(task,booking,source)||task.stage===stage)return;
  if(stage==='Done'&&!window.confirm(
   'Complete this INTERNAL COMPANY FOLLOW-UP TASK only? '+
   'The job, accepted scope, crew hours, invoice and collected funds remain unchanged.'
  ))return;
  setBusy(task.id);setError('');setNotice('');
  try{
   await updateExteriorSharedFollowupStage(
    org,booking.id,leadId,task.id,task.revision,stage,
   );
   setNotice('Member task status saved. Original booking and field work remain unchanged.');
   informOtherViews();
  }catch(e){
   setError(e instanceof Error?e.message:'The task changed or cannot be updated. Refresh before retrying.');
   onRefresh();
  }finally{setBusy(null);}
 };
 const addNote=async(task:SharedJobFollowup)=>{
  const body=comments[task.id]??'';
  if(busy||!linkedTaskActionable(task,booking,source)||!validOperatorNote(body))return;
  setBusy(task.id);setError('');setNotice('');
  try{
   await addExteriorSharedFollowupNote(org,booking.id,leadId,task.id,body.trim());
   setComments(v=>({...v,[task.id]:''}));
   setNotice('Internal progress update saved to the protected company board.');
   informOtherViews();
  }catch(e){
   setError(e instanceof Error?e.message:'Progress note did not save; refresh before retrying.');
   onRefresh();
  }finally{setBusy(null);}
 };
 return <div className="ecjob-loop" aria-label="Act on this booking with the company">
  {!canWrite&&<p className="ecjourney-alert" role="alert">
   <AlertTriangle size={15}/>
   Original booking was denied, cancelled, is not in a supported active state, or changed since the latest company task snapshot. Task updates and assignment are disabled until you refresh the original booking.
  </p>}
  {board.notesLimited&&<p className="ecjourney-coverage" role="status">Only the latest 200 company comments across loaded tasks are available. Older comments may not appear here; do not treat this as complete progress history.</p>}
  {board.limited&&<p className="ecjourney-alert" role="status">
   <AlertTriangle size={15}/>
   The booking task source window is incomplete or its count is unavailable (100-record cap). New assignment is paused until you inspect the full board for duplicates. Existing verified tasks can still be reviewed and updated.
  </p>}
  {error&&<p className="ecjourney-alert" role="alert"><AlertTriangle size={15}/>{error}</p>}
  {notice&&<p className="ecjourney-good" role="status"><CheckCircle2 size={15}/>{notice}</p>}
  <div className="ecjob-loop-grid">
   <section className="ecjob-compose" aria-label="Delegate this booking's next action">
    <header><span>FOUNDER → TEAM</span><h5><MessageSquarePlus size={18}/> Assign next action</h5>
     <p>One precise internal instruction linked to this original booking. The assignee can see it on their phone after refresh.</p>
    </header>
    <label>What should happen next?
     <textarea rows={3} maxLength={1200} value={note}
      onChange={e=>{changeIntent();setNote(e.target.value);}}
      disabled={!canWrite||!!busy}
      placeholder="Example: Verify water access before arrival, then post what you confirmed."/>
    </label>
    <label>Team member
     <select value={assignee} disabled={!canWrite||!!busy}
      onChange={e=>{changeIntent();setAssignee(e.target.value);}}>
      <option value="">Select active teammate…</option>
      {board.members.map(m=><option value={m.name} key={m.name}>{m.name}</option>)}
     </select>
    </label>
    <div className="ecjob-compose-pair">
     <label>Due date (optional)
      <input type="date" value={dueOn} disabled={!canWrite||!!busy}
       onChange={e=>{changeIntent();setDueOn(e.target.value);}}/>
     </label>
     <label>Priority
      <select value={priority} disabled={!canWrite||!!busy}
       onChange={e=>{changeIntent();setPriority(e.target.value as 'normal'|'high');}}>
       <option value="normal">Normal</option>
       <option value="high">High attention</option>
      </select>
     </label>
    </div>
    {duplicate&&<p className="ecjourney-coverage">
     An open company task already assigns this exact action to {duplicate.assignee} ({stageLabel(duplicate.stage)}). Review its progress instead of duplicating it.
    </p>}
    <button type="button" className="ecjob-primary" disabled={!canCreate}
     onClick={()=>void confirmCreation()}>
     <ClipboardCheck size={16}/>{busy==='create'?'Publishing…':'Assign internal task'}<ArrowRight size={15}/>
    </button>
    <small>Not a customer message, assigned crew shift, accepted estimate or confirmed dispatch. Saved only after your explicit confirmation.</small>
   </section>
   <section className="ecjob-progress" aria-label="Booking-linked tasks and progress">
    <header><span>TEAM → FOUNDER</span><h5><UsersRound size={18}/> Work and progress</h5>
     <p>{board.limited?'At least '+active.length:active.length} open task{active.length===1?'':'s'} · {all.length-active.length} marked done in the loaded source.</p>
    </header>
    {all.length===0&&!board.limited&&<p className="ecjourney-coverage">No booking-specific company tasks are recorded in this complete source window. This does not mean the job or its field evidence is complete.</p>}
    <div className="ecjob-worklist">
     {all.slice(0,10).map(task=>{
      const valid=linkedTaskActionable(task,booking,source);
      const taskNotes=board.notes.filter(n=>n.taskId===task.id).slice(0,5);
      return <article className="ecjob-work" key={task.id} data-stale={!valid}>
       <div className="ecjob-work-head">
        <strong>{task.assignee}</strong>
        <span>{stageLabel(task.stage)} · {task.priority==='high'?'High attention':'Normal'}</span>
       </div>
       <p>{task.note}</p>
       <small>{task.dueDate?'Due '+task.dueDate+' · ':''}{task.origin==='private-owner-reply-reference'?
        'References a private owner handoff · ':''}Company task only</small>
       {!valid&&<div className="ecjourney-alert"><AlertTriangle size={15}/>
        This action references an older or inactive booking. Refresh the original source before changing its stage or posting new instructions.
       </div>}
       <label>Progress
        <select aria-label={'Company progress for '+task.assignee}
         value={task.stage} disabled={!valid||!!busy}
         onChange={e=>void changeStage(task,e.target.value as FollowupStage)}>
         {task.stage==='Backlog'&&<option value="Backlog">Backlog (existing)</option>}
         {allowedFollowupStages.map(stage=><option value={stage} key={stage}>{stageLabel(stage)}</option>)}
        </select>
       </label>
       <div className="ecjob-comments" aria-label="Recent shared progress comments">
        {taskNotes.map(n=><p key={n.id}><b>{n.author}</b><time>{moment(n.createdAt)}</time><span>{n.body}</span></p>)}
        <div>
         <input type="text" value={comments[task.id]??''} maxLength={600}
          aria-label={'Progress update for '+task.assignee}
          disabled={!valid||!!busy}
          placeholder="Post one verified work update…"
          onChange={e=>setComments(v=>({...v,[task.id]:e.target.value}))}/>
         <button type="button" disabled={!valid||!!busy||!validOperatorNote(comments[task.id]??'')}
          onClick={()=>void addNote(task)}><MessageCircle size={15}/> Post</button>
        </div>
       </div>
      </article>;
     })}
    </div>
    {all.length>10&&<p className="ecjourney-coverage">Showing 10 of {all.length} loaded company tasks. Use the full board to inspect earlier work.</p>}
    <div className="ecjob-foot-actions">
     <button type="button" disabled={!!busy} onClick={onRefresh}>Refresh this job's shared work</button>
     <Link href={base+'/tasks?business=exterior'}>Company board <ArrowRight size={14}/></Link>
    </div>
   </section>
  </div>
  <p className="ecjob-disclaimer"><ShieldCheck size={15}/>
   All changes use authenticated member permissions and the existing organization board. A task marked Done is not a completed visit, owner sign-off, payable crew time or bank-cleared customer payment.
  </p>
 </div>;
}
