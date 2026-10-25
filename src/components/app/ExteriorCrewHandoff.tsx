'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {
 AlertTriangle,ArrowRight,CheckCircle2,ClipboardList,Download,FileDown,
 FileUp,ShieldAlert,Trash2,UsersRound,
} from 'lucide-react';
import type {ExtBooking,ExtLead} from '@/lib/exterior';
import type {ExteriorFieldLog} from '@/lib/exterior-field-log';
import {ExteriorSharedFollowups} from './ExteriorSharedFollowups';
import {loadSharedDraft,saveSharedDraft} from '@/app/workspace/shared-draft-actions';
import {reviewInternalCloseout} from '@/lib/exterior-closeout-review';
import {
 createFieldHandoffReply,createFieldHandoffRequest,handoffFileMaxChars,
 handoffRevisionMatchesField,newHandoffMailbox,parseFieldHandoffReply,
 parseFieldHandoffRequest,readHandoffMailbox,replyReviewStillCurrent,serializeHandoffMailbox,
 type FollowUpOwner,type HandoffDecision,type HandoffMailbox,
} from '@/lib/exterior-crew-handoff';

type Props={
 org:string;booking:ExtBooking;lead:ExtLead;bookings:readonly ExtBooking[];base:string;
 bookingCoverageComplete:boolean;field:ExteriorFieldLog|null;
 mode:'live'|'preview';readOnly:boolean;
};
const key=(org:string,booking:string)=>'oj-exterior-crew-handoff-v1:'+org+':'+booking;
const money=(n:number|null)=>n===null?'Unknown':
 new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const fmt=(s:string)=>new Date(s).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
function downloadPrivateFile(data:string,name:string){
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const link=document.createElement('a');
 link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function ExteriorCrewHandoff({
 org,booking,lead,bookings,bookingCoverageComplete,field,mode,readOnly,base,
}:Props){
 const enabled=mode==='live'&&!readOnly;
 const [mailbox,setMailbox]=useState<HandoffMailbox>(newHandoffMailbox);
 const [loaded,setLoaded]=useState(false);
 const [storageIssue,setStorageIssue]=useState('');
 const [notice,setNotice]=useState('');
 const [sharedStatus,setSharedStatus]=useState<'checking'|'ready'|'local-only'|'saving'|'conflict'|'offline'>('checking');
 const [sharedRevision,setSharedRevision]=useState<number|null>(null);
 const [sharedCopy,setSharedCopy]=useState<HandoffMailbox|null>(null);
 const [hadLocal,setHadLocal]=useState(false);
 const [sharedRefresh,setSharedRefresh]=useState(0);
 const mailboxRef=useRef<HandoffMailbox>(mailbox);
 const pendingShared=useRef<{data:HandoffMailbox;expected:number;commandId:string}|null>(null);
 const [operator,setOperator]=useState('');
 const [reviewer,setReviewer]=useState('');
 const [decision,setDecision]=useState<HandoffDecision>('follow-up-needed');
 const [followUpTo,setFollowUpTo]=useState<FollowUpOwner>('crew');
 const [dueOn,setDueOn]=useState('');
 const [note,setNote]=useState('');
 const requestUpload=useRef<HTMLInputElement|null>(null);
 const replyUpload=useRef<HTMLInputElement|null>(null);

 useEffect(()=>{
  setMailbox(newHandoffMailbox());setLoaded(false);setHadLocal(false);
  setSharedStatus('checking');setSharedRevision(null);setSharedCopy(null);pendingShared.current=null;
  setStorageIssue('');setNotice('');
  setOperator('');setReviewer('');setDecision('follow-up-needed');setFollowUpTo('crew');setDueOn('');setNote('');
  if(!enabled){setLoaded(true);return;}
  try{
   const raw=window.localStorage.getItem(key(org,booking.id));
   setHadLocal(Boolean(raw));
   setMailbox(readHandoffMailbox(raw,org,booking.id,lead.id));
  }catch{
   setStorageIssue('The saved private handoff mailbox is unreadable or does not match this job. It was preserved. Do not overwrite it without first recovering the file.');
  }
  setLoaded(true);
 },[org,booking.id,lead.id,enabled]);

 mailboxRef.current=mailbox;
 useEffect(()=>{
  if(!enabled||!loaded||storageIssue)return;
  let cancelled=false;setSharedStatus('checking');
  void loadSharedDraft(org,'exterior_handoff',booking.id).then(doc=>{
   if(cancelled)return;
   setSharedRevision(doc?.revision??0);setSharedCopy(doc?.payload.mailbox??null);
   if(!doc){setSharedStatus('local-only');return;}
   const local=mailboxRef.current;
   if((!hadLocal&&JSON.stringify(local)===JSON.stringify(newHandoffMailbox()))||
      JSON.stringify(local)===JSON.stringify(doc.payload.mailbox)){
    setMailbox(doc.payload.mailbox);setSharedStatus('ready');
   }else{
    setSharedStatus('conflict');
    setNotice('Private crew mailbox differs from shared data. Neither record was overwritten.');
   }
  }).catch(e=>{
   if(cancelled)return;setSharedStatus('offline');
   setNotice(e instanceof Error?e.message:'Shared handoff storage is unavailable. Browser mailbox preserved.');
  });
  return ()=>{cancelled=true;};
 },[org,booking.id,lead.id,enabled,loaded,storageIssue,hadLocal,sharedRefresh]); // eslint-disable-line react-hooks/exhaustive-deps
 const incomingReview=useMemo(()=>{
  if(!mailbox.incoming)return null;
  try{return {ok:true as const,data:reviewInternalCloseout(
   booking,lead,bookings,mailbox.incoming.field,bookingCoverageComplete,
  )};}catch(e){return {ok:false as const,message:e instanceof Error?e.message:'Review unavailable'};}
 },[mailbox.incoming,booking,lead,bookings,bookingCoverageComplete]);
 const incomingResult=incomingReview?.ok?incomingReview.data:null;
 const outgoingChanged=Boolean(mailbox.outgoing&&field&&
  !handoffRevisionMatchesField(mailbox.outgoing,field));
 const canAct=enabled&&loaded&&!storageIssue;
 const persist=(next:HandoffMailbox):boolean=>{
  if(!canAct)return false;
  try{
   const payload=serializeHandoffMailbox(next,org,booking.id,lead.id);
   window.localStorage.setItem(key(org,booking.id),payload);
   setMailbox(next);if(sharedStatus==='ready')setSharedStatus('local-only');return true;
  }catch(e){
   setNotice(e instanceof Error?'Could not safely save this private handoff: '+e.message:
    'Browser storage denied the handoff; existing data was left untouched.');
   return false;
  }
 };
 const prepareRequest=()=>{
  if(!canAct||!field)return;
  if(!window.confirm(
   'Download a PRIVATE JSON field record with labor costs, site notes and possible customer data? '+ 
   'Share only through a trusted private channel. This does not send anything from the app.'
  ))return;
  try{
   if(typeof crypto==='undefined'||!crypto.randomUUID)throw Error('Secure request identifier unavailable.');
   const packet=createFieldHandoffRequest(
    org,booking,lead,field,operator,crypto.randomUUID(),
   );
   if(!persist({...mailbox,outgoing:packet,incomingReply:null}))return;
   downloadPrivateFile(JSON.stringify(packet,null,2),'oj-private-crew-'+booking.id.slice(0,8)+'.json');
   setNotice('Private crew packet saved on THIS device and downloaded. Manually send it to the other founder via a trusted channel.');
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to prepare the private crew handoff.');}
 };
 const importRequest=async(file?:File)=>{
  if(!file||!canAct)return;
  if(file.size>handoffFileMaxChars*4){setNotice('Crew file exceeds maximum supported size.');return;}
  try{
   const packet=parseFieldHandoffRequest(await file.text(),org,booking.id,lead.id);
   if(mailbox.incoming&&!window.confirm(
    'Replace the local incoming crew review and any prepared owner reply? The original field log and booking will NOT change.'
   ))return;
   if(!persist({...mailbox,incoming:packet,outgoingReply:null}))return;
   setDecision('follow-up-needed');setFollowUpTo('crew');setDueOn('');setNote('');
   setNotice('Crew packet imported for this exact job. You must independently verify its author and the site evidence; no company records were changed.');
  }catch(e){setNotice(e instanceof Error?e.message:'Crew import rejected; earlier information preserved.');}
 };
 const prepareReply=()=>{
  if(!canAct||!mailbox.incoming)return;
  if(!window.confirm(
   'Prepare an INTERNAL owner reply file only? The stated reviewer identity is manually entered, not authenticated, and no crew notification is sent.'
  ))return;
  try{
   const packet=createFieldHandoffReply(
    mailbox.incoming,booking,lead,bookings,bookingCoverageComplete,
    {reviewedBy:reviewer,decision,
     followUpTo:decision==='reviewed-internally'?'none':followUpTo,
     dueOn:decision==='reviewed-internally'?null:(dueOn||null),note},
   );
   if(!persist({...mailbox,outgoingReply:packet}))return;
   downloadPrivateFile(JSON.stringify(packet,null,2),'oj-private-owner-reply-'+booking.id.slice(0,8)+'.json');
   setNotice('Private owner response saved here and downloaded. It must be sent to the crew manually; it is not a customer acceptance or completed-job record.');
  }catch(e){setNotice(e instanceof Error?e.message:'Owner review could not be prepared.');}
 };
 const importReply=async(file?:File)=>{
  if(!file||!canAct)return;
  if(file.size>handoffFileMaxChars*4){setNotice('Owner reply exceeds maximum supported size.');return;}
  try{
   if(!mailbox.outgoing)throw Error('First prepare the matching crew request on this browser; no original handoff revision is saved.');
   const packet=parseFieldHandoffReply(await file.text(),org,booking.id,lead.id,mailbox.outgoing);
   if(packet.decision==='reviewed-internally'&&!replyReviewStillCurrent(
    mailbox.outgoing,packet,booking,lead,bookings,bookingCoverageComplete,
   ))throw Error('The review is no longer source-current or safe. Import requires a fresh crew handoff, not an outdated clear status.');
   if(mailbox.incomingReply&&!window.confirm(
    'Replace the existing private owner reply for this original handoff? The field log and booking will remain unchanged.'
   ))return;
   if(!persist({...mailbox,incomingReply:packet}))return;
   setNotice('Owner response imported for the matching private request. A response is not verified signoff, a shared assignment or an automatic job update.');
  }catch(e){setNotice(e instanceof Error?e.message:'Owner reply rejected; existing data preserved.');}
 };
 async function submitHandoff(attempt:{data:HandoffMailbox;expected:number;commandId:string}){
  setSharedStatus('saving');
  try{
   const response=await saveSharedDraft(org,'exterior_handoff',booking.id,
    attempt.expected,attempt.commandId,
    {bookingId:booking.id,leadId:lead.id,mailbox:attempt.data});
   if(response.status==='conflict'){
    pendingShared.current=null;setSharedRevision(response.currentRevision);setSharedStatus('conflict');
    setNotice('Company handoff revision changed. The browser mailbox remains intact for explicit reconciliation.');
    return;
   }
   pendingShared.current=null;setSharedRevision(response.revision);setSharedCopy(attempt.data);
   if(JSON.stringify(mailboxRef.current)===JSON.stringify(attempt.data)){
    setSharedStatus('ready');
    setNotice('Internal crew mailbox saved to Supabase. This does not deliver a message, authenticate a typed reviewer name or complete a job.');
   }else{
    setSharedStatus('local-only');
    setNotice('A previous crew mailbox revision synced, but newer local changes require another save.');
   }
  }catch(error){
   setSharedStatus('offline');
   setNotice((error instanceof Error?error.message:'Shared crew handoff save was not confirmed.')+' Retry the ORIGINAL command; local copy is protected.');
  }
 }
 function syncHandoff(){
  if(!canAct||sharedRevision===null||sharedStatus==='checking'||
     sharedStatus==='saving'||sharedStatus==='conflict'||pendingShared.current)return;
  try{
   const safe=readHandoffMailbox(serializeHandoffMailbox(mailboxRef.current,org,booking.id,lead.id),
     org,booking.id,lead.id);
   const attempt={data:safe,expected:sharedRevision,commandId:crypto.randomUUID()};
   pendingShared.current=attempt;void submitHandoff(attempt);
  }catch(error){setNotice(error instanceof Error?error.message:'Crew mailbox validation failed.');}
 }
 function adoptSharedHandoff(){
  if(!canAct||!sharedCopy||sharedStatus!=='conflict')return;
  if(!window.confirm('Open the shared crew mailbox? First preserve the complete local handoff and cost-containing packets in a private recovery copy. This is not job approval.'))return;
  try{
   const original=serializeHandoffMailbox(mailboxRef.current,org,booking.id,lead.id);
   window.localStorage.setItem('oj-handoff-protected-recovery:'+org+':'+booking.id+':'+Date.now(),original);
   downloadPrivateFile(original,'oj-crew-local-before-shared-'+booking.id.slice(0,8)+'.json');
   window.localStorage.setItem(key(org,booking.id),serializeHandoffMailbox(sharedCopy,org,booking.id,lead.id));
   setMailbox(sharedCopy);setSharedStatus('ready');setHadLocal(false);
   setNotice('Shared internal mailbox opened; original device copy preserved separately. Reviewer names are still unverified.');
  }catch(error){setNotice(error instanceof Error?error.message:'Could not preserve local crew mailbox; shared copy not opened.');}
 }
 const reset=()=>{
  if(!canAct||!window.confirm(
   'Delete this booking’s LOCAL crew/owner handoff mailbox, including saved transfer versions and replies? Original field logs, bookings and any files already shared remain unchanged.'
  ))return;
  try{
   window.localStorage.removeItem(key(org,booking.id));
   setMailbox(newHandoffMailbox());setSharedStatus('local-only');setNotice('Local handoff mailbox reset. Original job and field data were unchanged.');
  }catch{setNotice('Storage reset failed; earlier private handoff data was preserved.');}
 };
 const incoming=mailbox.incoming;
 const incomingField=incoming?.field;
 const receipt=mailbox.incomingReply;
 const receiptStillCurrent=Boolean(receipt&&mailbox.outgoing&&replyReviewStillCurrent(
  mailbox.outgoing,receipt,booking,lead,bookings,bookingCoverageComplete));
 const canReply=!!incomingResult&&canAct&&reviewer.trim().length>0&&
  (decision!=='reviewed-internally'||incomingResult.reviewable)&&
  (decision!=='follow-up-needed'||(followUpTo!=='none'&&note.trim().length>=10));
 return <section className="ecfield-panel ecfield-crewbridge" aria-label="Private crew and owner handoff">
  <header className="ecfield-heading">
   <div><span className="ecfield-overline">12 / TWO-FOUNDER HANDOFF DESK</span>
    <h2>Field crew <ArrowRight size={17} aria-hidden="true"/> owner review</h2>
    <p>Exchange a private job packet, review the evidence and return an actionable owner note. Internal mailbox drafts may now be synchronized to Supabase after review. File downloads still require deliberate transfer; typed reviewer identities are unverified and no customer messaging is automatic.</p>
   </div><UsersRound size={23}/>
  </header>
  {enabled&&<div className="ecfield-crewbridge-actions" role="group" aria-label="Shared crew mailbox controls">
    <button type="button" disabled={!canAct||sharedRevision===null||sharedStatus==='checking'||sharedStatus==='saving'||sharedStatus==='conflict'||!!pendingShared.current} onClick={syncHandoff}>Save handoff to company</button>
    {pendingShared.current&&<button type="button" disabled={sharedStatus==='saving'} onClick={()=>{if(pendingShared.current)void submitHandoff(pendingShared.current);}}>Retry original company save</button>}
    {sharedStatus==='conflict'&&sharedCopy&&<button type="button" onClick={adoptSharedHandoff}>Export local &amp; open shared</button>}
    {sharedStatus==='offline'&&!pendingShared.current&&<button type="button" onClick={()=>setSharedRefresh(v=>v+1)}>Retry shared connection</button>}
    <span role="status">Company save: {sharedStatus==='ready'?'Synced · revision '+sharedRevision:sharedStatus==='saving'?'Saving':sharedStatus==='checking'?'Checking':sharedStatus==='conflict'?'Conflicting copies':'Local only / unavailable'}</span>
   </div>}
  {!enabled&&<p className="ecfield-notice">Read-only/preview mode: private device records and file actions are disabled.</p>}
  {storageIssue&&<p className="ecfield-warning" role="alert"><ShieldAlert size={17}/>{storageIssue}</p>}
  <div className="ecfield-crewbridge-steps">
   <article>
    <div className="ecfield-crewbridge-step"><span>01</span><strong>From the field</strong><small>For Jacob / crew</small></div>
    <p>Capture your current field worksheet as a versioned internal package for the owner to review.</p>
    <label>Who prepared these notes?
     <input value={operator} disabled={!canAct} maxLength={64}
      onChange={e=>setOperator(e.target.value)} placeholder="Your name (self-entered)"/>
    </label>
    <button className="ecfield-crewbridge-action" type="button" onClick={prepareRequest}
     disabled={!canAct||!field||!operator.trim()}>
     <FileDown size={16}/> Download crew review packet
    </button>
    {mailbox.outgoing&&<div className="ecfield-crewbridge-receipt">
     <strong>Prepared locally · {fmt(mailbox.outgoing.issued_at)}</strong>
     <small>Request: {mailbox.outgoing.request_id.slice(0,18)}…</small>
     <small>Manually share the JSON file; downloading does not deliver it.</small>
     {outgoingChanged&&<p className="ecfield-crewbridge-alert">The field worksheet has changed since this packet. Download a new request before relying on a reply.</p>}
    </div>}
   </article>
   <article>
    <div className="ecfield-crewbridge-step"><span>02</span><strong>Owner desk</strong><small>For Oscar / reviewer</small></div>
    <p>Import the crew file from a trusted channel. It cannot overwrite the current device’s working field draft.</p>
    <button type="button" className="ecfield-crewbridge-secondary" disabled={!canAct}
     onClick={()=>requestUpload.current?.click()}><FileUp size={16}/> Import crew packet</button>
    <input hidden ref={requestUpload} type="file" accept=".json,application/json"
     aria-label="Import private crew handoff packet" onChange={e=>{
      const f=e.currentTarget.files?.[0];e.currentTarget.value='';void importRequest(f);
     }}/>
    {incoming&&<div className="ecfield-crewbridge-inbox">
     <div className="ecfield-crewbridge-receipt">
      <strong>Received by manual import</strong>
      <small>Entered by: {incoming.prepared_by} · {fmt(incoming.issued_at)}</small>
      <small>Review of exact source booking {incoming.booking_id}</small>
     </div>
     {incomingResult?<>
      <div className="ecfield-crewbridge-metrics">
       <div><small>Entered direct cost</small><strong>{money(incomingResult.fieldCost?.totalDirectCost??null)}</strong></div>
       <div><small>Reviewed labor time</small><strong>{incomingResult.hoursReviewed===null?'Unknown':incomingResult.hoursReviewed+' h'}</strong></div>
      </div>
      <p className={incomingResult.reviewable?'ecfield-crewbridge-ready':'ecfield-crewbridge-alert'}>
       {incomingResult.reviewable?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}
       {incomingResult.reviewable?'No local field blockers, owner still must verify work.':
        incomingResult.blockers.length+' missing/unsafe source or field items need follow-up.'}
      </p>
      {incomingResult.blockers.length>0&&<details className="ecfield-crewbridge-detail" open>
       <summary>Outstanding crew/source items ({incomingResult.blockers.length})</summary>
       <ul>{incomingResult.blockers.map(v=><li key={v.code}>{v.label}</li>)}</ul>
      </details>}
     </>:<p className="ecfield-crewbridge-alert">Original field review could not be established.</p>}
     <details className="ecfield-crewbridge-detail">
      <summary>Inspect imported field evidence</summary>
      <div className="ecfield-crewbridge-evidence">
       <p><strong>Local stage:</strong> {incomingField?.stage??'Unknown'}</p>
       <p><strong>Site notes:</strong> {incomingField?.siteNotes||'Not entered'}</p>
       <p><strong>Arrival/departure:</strong> {incomingField?.arrivalAt?fmt(incomingField.arrivalAt):'Missing'} / {incomingField?.departureAt?fmt(incomingField.departureAt):'Missing'}</p>
       <strong>Crew entries</strong>
       <ul>{incomingField?.labor.length?incomingField.labor.map(v=>
        <li key={v.id}>{v.role}: {v.hours===null?'Unknown':v.hours+' hours'} at {money(v.hourlyCost)} / h · {v.notes||'No notes'}</li>
       ):<li>No crew entries submitted.</li>}</ul>
       <strong>Materials</strong>
       <ul>{incomingField?.materials.length?incomingField.materials.map(v=>
        <li key={v.id}>{v.name}: {v.quantity??'Unknown'} × {money(v.unitCost)} · {v.notes||'No notes'}</li>
       ):<li>No material entries submitted.</li>}</ul>
       <strong>Issues and observations</strong>
       <ul>{incomingField?.issues.length?incomingField.issues.map(v=>
        <li key={v.id}>{v.severity} / {v.category}: {v.description} ({v.resolved?'locally resolved':'open'})</li>
       ):<li>No issues entered (not a verified all-clear).</li>}</ul>
      </div>
     </details>
     <div className="ecfield-crewbridge-response">
      <label>Reviewed by (manually entered)
       <input maxLength={64} disabled={!canAct} value={reviewer}
        onChange={e=>setReviewer(e.target.value)} placeholder="Reviewer name"/>
      </label>
      <label>Internal disposition
       <select disabled={!canAct} value={decision}
        onChange={e=>setDecision(e.target.value as HandoffDecision)}>
        <option value="follow-up-needed">Needs follow-up</option>
        <option value="reviewed-internally" disabled={!incomingResult?.reviewable}>Reviewed internally (NOT finalized)</option>
       </select>
      </label>
      {decision==='follow-up-needed'&&<>
       <label>Who needs to act next?
        <select disabled={!canAct} value={followUpTo}
         onChange={e=>setFollowUpTo(e.target.value as FollowUpOwner)}>
         <option value="crew">Crew / field operator</option>
         <option value="owner">Owner / manager</option>
        </select>
       </label>
       <label>Follow-up target date (optional)
        <input type="date" value={dueOn} disabled={!canAct} onChange={e=>setDueOn(e.target.value)}/>
       </label>
      </>}
      <label>Owner instructions / evidence notes
       <textarea rows={3} maxLength={1500} disabled={!canAct} value={note}
        onChange={e=>setNote(e.target.value)}
        placeholder="What must be checked, fixed, confirmed or handed over?"/>
      </label>
      <button className="ecfield-crewbridge-action" type="button" onClick={prepareReply}
       disabled={!canReply}><Download size={16}/> Download private owner reply</button>
      {mailbox.outgoingReply&&<small>Latest response prepared on this browser at {fmt(mailbox.outgoingReply.replied_at)}. Send the downloaded reply file manually.</small>}
     </div>
    </div>}
   </article>
   <article>
    <div className="ecfield-crewbridge-step"><span>03</span><strong>Back to crew</strong><small>Owner follow-up</small></div>
    <p>Import the matching owner reply file to view the next assigned action. Responses never modify your working field worksheet.</p>
    <button type="button" className="ecfield-crewbridge-secondary" disabled={!canAct}
     onClick={()=>replyUpload.current?.click()}><FileUp size={16}/> Import owner reply</button>
    <input hidden ref={replyUpload} type="file" accept=".json,application/json"
     aria-label="Import private owner response" onChange={e=>{
      const f=e.currentTarget.files?.[0];e.currentTarget.value='';void importReply(f);
     }}/>
    {receipt&&<div className="ecfield-crewbridge-feedback">
     <strong>{receipt.decision==='follow-up-needed'?'Follow-up requested':'Internally reviewed (not signed off)'}</strong>
     <small>Manually entered reviewer: {receipt.reviewed_by} · {fmt(receipt.replied_at)}</small>
     {receipt.decision==='follow-up-needed'&&<p><strong>Next:</strong> {receipt.follow_up_to==='crew'?'Crew action':'Owner action'}
      {receipt.due_on?' · Target '+receipt.due_on:''}</p>}
     <p className="ecfield-crewbridge-note">{receipt.note||'No reviewer note entered.'}</p>
     {outgoingChanged&&<p className="ecfield-crewbridge-alert">Field notes changed after the reviewed packet. This reply references the earlier request and is not a review of current edits.</p>}
     {!receiptStillCurrent&&<p className="ecfield-crewbridge-alert">The original booking or its source evidence has changed. Do not treat this reply as a current review; return to the source booking and create a new crew handoff.</p>}
     <small>Reply identity is not cryptographically verified. Confirm the sender through your trusted private channel.</small>
    </div>}
   </article>
  </div>
  <ExteriorSharedFollowups org={org} booking={booking} lead={lead} base={base}
   mode={mode} readOnly={readOnly} ownerReply={mailbox.outgoingReply}/>
  <div className="ecfield-crewbridge-foot">
   <p><ClipboardList size={16}/> All packages contain private operator-entered information. Store and share carefully. This is not shared cloud storage, a certified owner identity, a signed job, an invoice, payroll or evidence of customer payment.</p>
   <button type="button" disabled={!canAct} onClick={reset}><Trash2 size={14}/> Reset local handoff history</button>
  </div>
  {notice&&<p className="ecfield-toast" role="status">{notice}</p>}
 </section>;
}
