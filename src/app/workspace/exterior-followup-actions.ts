'use server';

import {requireMember} from '@/lib/supabase';
import type {Card} from '@/lib/board';
import {
 allowedFollowupStages,isJobFollowupFor,makeJobFollowupCard,
 parseJobFollowupReceipt,projectJobFollowup,sameJobFollowupAttempt,sourceWindowComplete,uuid,
  type OlderJobTaskPage,
 type FollowupStage,type NewJobFollowup,type SharedJobFollowup,
} from '@/lib/exterior-job-followup';
import type {ExtBooking} from '@/lib/exterior';
import {originalJobMatchesTask} from '@/lib/exterior-operations-inbox';

/** Existing RLS-protected oj_cards + oj_comments only. NO new schema, no
 * elevated/service-role token, private field report upload or customer write. */
type TeamMember={name:string};
export type TaskNote={id:string;taskId:string;body:string;author:string;createdAt:string};
type TaskResult={ok:true;tasks:SharedJobFollowup[];members:TeamMember[];notes:TaskNote[];limited:boolean;notesLimited:boolean;taskWindow:number;taskTotal:number|null;
 source:{date:string;time:string|null;status:string|null}} |
 {ok:false;reason:string};
const eligibleRole=(role:string)=>role==='owner'||role==='member';
const baseQuery=(org:string,bookingId:string,leadId:string)=>
 uuid.test(org)&&uuid.test(bookingId)&&uuid.test(leadId);
const fields='id,organization_id,title,description,business,stage,priority,assignee,due_date,revision,created_at,updated_at';
const asCard=(row:unknown)=>row as Card&{created_at:string;updated_at:string};
const errors=(e:unknown)=>e instanceof Error?e.message:'Shared follow-up request failed.';

/** Re-query the original booking and lead through the founder's own session.
 * Original booking identity is authoritative; client labels never are. */
async function source(client:Awaited<ReturnType<typeof requireMember>>['client'],
 bookingId:string,leadId:string):Promise<ExtBooking>{
 const {data:b,error:e}=await client.from('bookings')
  .select('id,lead_id,date,time_block,status').eq('id',bookingId).maybeSingle();
 if(e||!b||b.lead_id!==leadId)throw Error('The original booked job could not be verified with your current access.');
 const {data:l,error:le}=await client.from('leads').select('id').eq('id',leadId).maybeSingle();
 if(le||!l)throw Error('The exact customer source is no longer accessible.');
 return b as ExtBooking;
}
async function memberNames(client:Awaited<ReturnType<typeof requireMember>>['client'],org:string){
 const {data,count,error}=await client.from('oj_memberships')
  .select('display_name,role',{count:'exact'}).eq('organization_id',org).order('display_name').limit(100);
 if(error||!data)throw Error('Current company members could not be loaded.');
 if(!sourceWindowComplete(count,data.length,100))
  throw Error('Company membership list is incomplete; refusing ambiguous team assignment.');
 const counts=new Map<string,number>();
 for(const row of data)if(eligibleRole(row.role)&&typeof row.display_name==='string'){
  counts.set(row.display_name,(counts.get(row.display_name)??0)+1);
 }
 // Board assignments use display names, not immutable member IDs. Refuse
 // ambiguous names instead of guessing who will own a real job follow-up.
 return [...counts].filter(([name,count])=>count===1&&name.trim()&&name.length<=120)
  .map(([name])=>({name}));
}
export async function loadExteriorSharedFollowups(
 org:string,bookingId:string,leadId:string,
):Promise<TaskResult>{
 if(!baseQuery(org,bookingId,leadId))return {ok:false,reason:'An exact company, booking and customer are required.'};
 try{
  const {client}=await requireMember(org,true);
  const [original,members]=await Promise.all([
   source(client,bookingId,leadId),memberNames(client,org),
  ]);
  const {data, count,error}=await client.from('oj_cards')
   .select(fields,{count:'exact'}).eq('organization_id',org).eq('business','exterior')
   .like('description','%Exterior booking ID: '+bookingId+'%')
   .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
  if(error||!data)throw Error('Shared job follow-ups are unavailable; no local substitute was shown.');
  const tasks=data.map(row=>projectJobFollowup(asCard(row),org,bookingId,leadId))
   .filter((v):v is SharedJobFollowup=>v!==null);
  const ids=tasks.map(t=>t.id);
  let notes:TaskNote[]=[];
  let notesLimited=false;
  if(ids.length){
   const {data:comments,count:commentCount,error:ce}=await client.from('oj_comments')
    .select('id,card_id,body,author_id,created_at',{count:'exact'}).eq('organization_id',org)
    .in('card_id',ids).order('created_at',{ascending:false}).limit(200);
   if(ce||!comments)throw Error('Shared task comments could not be loaded. No partial board state was shown.');
   notesLimited=!sourceWindowComplete(commentCount,comments.length,200);
   const {data:memberRows,count:memberCount,error:me}=await client.from('oj_memberships')
    .select('user_id,display_name',{count:'exact'}).eq('organization_id',org).limit(100);
   if(me||!memberRows||!sourceWindowComplete(memberCount,memberRows.length,100))
    throw Error('Cannot safely attribute shared comments: membership source is incomplete.');
   const names=new Map((memberRows??[]).map(x=>[x.user_id,x.display_name]));
   notes=(comments??[]).map(c=>({
    id:c.id,taskId:c.card_id,body:c.body,author:names.get(c.author_id)??'Former member',
    createdAt:c.created_at,
   }));
  }
  return {ok:true,tasks,members,notes,
   limited:!sourceWindowComplete(count,data.length,100),notesLimited,
   taskWindow:data.length,taskTotal:count,
   source:{date:original.date,time:original.time_block,status:original.status}};
 }catch(e){return {ok:false,reason:errors(e)};}
}

/** Publish a very small operational next action, never the private field log.
 * Inserts into the already existing shared board for current members only.
 * UUID taskId means double-click/network retry doesn't duplicate the task.
 */
export async function createExteriorSharedFollowup(
 org:string,bookingId:string,input:NewJobFollowup,
):Promise<SharedJobFollowup>{
 if(!baseQuery(org,bookingId,input.leadId))throw Error('Invalid exact source identifiers.');
 const {client,user}=await requireMember(org,true);
 const [booking,members]=await Promise.all([
  source(client,bookingId,input.leadId),memberNames(client,org),
 ]);
 if(!members.some(m=>m.name===input.assignee))
  throw Error('Choose an active, unambiguous owner/member to assign the company task.');
 const card=makeJobFollowupCard(org,booking,input);
 const {data:existing,error:lookupError}=await client.from('oj_cards')
  .select(fields).eq('id',card.id).eq('organization_id',org).maybeSingle();
 if(lookupError)throw Error('Could not check for an earlier saved follow-up.');
 if(existing){
  const previous=projectJobFollowup(asCard(existing),org,bookingId,input.leadId);
  if(!previous||!sameJobFollowupAttempt(previous,input))
   throw Error('The chosen task identifier already belongs to another record.');
  return previous;
 }
 const {data,error}=await client.from('oj_cards').insert({
  ...card,created_by:user.id,due_date:card.due_date||null,
 }).select(fields).single();
 if(error||!data){
  // A simultaneous retry might have inserted the same UUID. Only accept a
  // record whose exact scoped job receipt is verified by a new RLS-bound read.
  const {data:again}=await client.from('oj_cards').select(fields)
   .eq('id',card.id).eq('organization_id',org).maybeSingle();
  const prior=again&&projectJobFollowup(asCard(again),org,bookingId,input.leadId);
  if(prior&&sameJobFollowupAttempt(prior,input))return prior;
  throw Error('Follow-up was not saved to the shared company board. Please retry.');
 }
 const saved=projectJobFollowup(asCard(data),org,bookingId,input.leadId);
 if(!saved)throw Error('Saved task did not retain the required exact booking receipt.');
 return saved;
}

/** DB trigger increments revision only when the supplied original revision
 * matches. A zero-row update is a conflict, not a success. "Done" is solely
 * a task-board state; this never finalizes the actual customer booking. */
export async function updateExteriorSharedFollowupStage(
 org:string,bookingId:string,leadId:string,taskId:string,
 expectedRevision:number,stage:FollowupStage,
):Promise<SharedJobFollowup>{
 if(!baseQuery(org,bookingId,leadId)||!uuid.test(taskId)||!Number.isInteger(expectedRevision)||
   expectedRevision<0||!allowedFollowupStages.includes(stage))
  throw Error('Invalid shared task state update.');
 const {client}=await requireMember(org,true);
 const booking=await source(client,bookingId,leadId);
 const {data:stored,error:readError}=await client.from('oj_cards')
  .select(fields).eq('organization_id',org).eq('id',taskId).maybeSingle();
 if(readError||!stored||!isJobFollowupFor(stored.description,org,bookingId,leadId))
  throw Error('This task is no longer associated with the verified original job.');
 const receipt=parseJobFollowupReceipt(stored.description);
 if(!receipt||!originalJobMatchesTask({
   sourceDate:receipt.sourceDate,sourceTime:receipt.sourceTime,sourceStatus:receipt.sourceStatus,
  },booking))
  throw Error('The original booking date, time or status changed. Reopen the booking before advancing the company task.');
 if(stored.revision!==expectedRevision)throw Error('Another founder edited this task. Refresh before changing its status.');
 const {data,error}=await client.from('oj_cards').update({
  stage,revision:expectedRevision,
 }).eq('id',taskId).eq('organization_id',org).eq('revision',expectedRevision)
  .select(fields).maybeSingle();
 if(error||!data)throw Error('Task changed on another device or access was denied. Refresh the shared board.');
 const result=projectJobFollowup(asCard(data),org,bookingId,leadId);
 if(!result)throw Error('The updated task lost its original booking receipt.');
 return result;
}
export async function addExteriorSharedFollowupNote(
 org:string,bookingId:string,leadId:string,taskId:string,body:string,
):Promise<TaskNote>{
 if(!baseQuery(org,bookingId,leadId)||!uuid.test(taskId)||
    typeof body!=='string'||body.trim().length<3||body.length>600||
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(body))
  throw Error('Use a 3–600 character operational note.');
 const {client,user,member}=await requireMember(org,true);
 const booking=await source(client,bookingId,leadId);
 const {data:card,error:readError}=await client.from('oj_cards')
  .select('id,description').eq('id',taskId).eq('organization_id',org).maybeSingle();
 if(readError||!card||!isJobFollowupFor(card.description,org,bookingId,leadId))
  throw Error('Cannot add a note to a task from a different booking.');
 // A company comment can change an operator's next action just as much as
 // a stage change. Never append new guidance to an obsolete or cancelled job.
 const receipt=parseJobFollowupReceipt(card.description);
 if(!receipt||!originalJobMatchesTask({
  sourceDate:receipt.sourceDate,sourceTime:receipt.sourceTime,sourceStatus:receipt.sourceStatus,
 },booking))
  throw Error('The original booking changed or was cancelled. Refresh the exact job before posting new instructions.');
 const {data,error}=await client.from('oj_comments').insert({
  card_id:taskId,organization_id:org,author_id:user.id,body:body.trim(),
 }).select('id,card_id,body,created_at').single();
 if(error||!data)throw Error('Your task note was not saved. Check company access and retry.');
 return {id:data.id,taskId:data.card_id,body:data.body,author:member.display_name,createdAt:data.created_at};
}

/** R46: pagination never reads arbitrary cards or trusts client-provided labels.
 * Only a member-accessible, exact original booking + lead is eligible.
 * Stable created_at/id ordering and total-count comparison allow the client
 * to reject obvious concurrent insertion/deletion rather than pretending
 * multiple independent PostgREST queries share a snapshot. */
export async function loadMoreExteriorJobTasks(
 org:string,bookingId:string,leadId:string,offset:number,
):Promise<({ok:true}&OlderJobTaskPage)|{ok:false;reason:string}>{
 if(!baseQuery(org,bookingId,leadId)||!Number.isInteger(offset)||
   offset<100||offset>900||offset%100!==0)
  return {ok:false,reason:'Invalid bounded job-task page request.'};
 try{
  const {client}=await requireMember(org,true);
  const original=await source(client,bookingId,leadId);
  const {data,count,error}=await client.from('oj_cards')
   .select(fields,{count:'exact'}).eq('organization_id',org).eq('business','exterior')
   .like('description','%Exterior booking ID: '+bookingId+'%')
   .order('created_at',{ascending:false}).order('id',{ascending:false})
   .range(offset,offset+99);
  if(error||!data)throw Error('Older company tasks could not be read from the authorized source.');
  return {ok:true,offset,scanned:data.length,total:count,
   tasks:data.map(row=>projectJobFollowup(asCard(row),org,bookingId,leadId))
    .filter((v):v is SharedJobFollowup=>v!==null),
   source:{date:original.date,time:original.time_block,status:original.status}};
 }catch(e){return {ok:false,reason:errors(e)};}
}

export type TaskCommentPage=
 {ok:true;taskId:string;offset:number;scanned:number;total:number|null;notes:TaskNote[]}|
 {ok:false;reason:string};

/** On-demand individual-task historical comments. The original booking,
 * board receipt and author membership are rechecked under the caller's own
 * RLS-scoped client. Read-only: no comments or source records are changed. */
export async function loadExteriorJobCommentPage(
 org:string,bookingId:string,leadId:string,taskId:string,offset:number,
):Promise<TaskCommentPage>{
 if(!baseQuery(org,bookingId,leadId)||!uuid.test(taskId)||
   !Number.isInteger(offset)||offset<0||offset>950||offset%50!==0)
  return {ok:false,reason:'Invalid bounded task-comment history request.'};
 try{
  const {client}=await requireMember(org,true);
  await source(client,bookingId,leadId);
  const {data:card,error:readError}=await client.from('oj_cards')
   .select('description').eq('organization_id',org).eq('id',taskId)
   .eq('business','exterior').maybeSingle();
  if(readError||!card||!isJobFollowupFor(card.description,org,bookingId,leadId))
   throw Error('The task is not linked to the verified original booking.');
  const [{data,count,error},{data:memberRows,count:memberCount,error:memberError}]=await Promise.all([
   client.from('oj_comments').select('id,card_id,body,author_id,created_at',{count:'exact'})
    .eq('organization_id',org).eq('card_id',taskId)
    .order('created_at',{ascending:false}).order('id',{ascending:false})
    .range(offset,offset+49),
   client.from('oj_memberships').select('user_id,display_name',{count:'exact'})
    .eq('organization_id',org).limit(100),
  ]);
  if(error||!data)throw Error('Authenticated comment history is unavailable.');
  if(memberError||!memberRows||!sourceWindowComplete(memberCount,memberRows.length,100))
   throw Error('Cannot safely attribute historical company comments.');
  const names=new Map(memberRows.map(x=>[x.user_id,x.display_name]));
  return {ok:true,taskId,offset,scanned:data.length,total:count,
   notes:data.map(c=>({id:c.id,taskId:c.card_id,body:c.body,
    author:names.get(c.author_id)??'Former member',createdAt:c.created_at}))};
 }catch(e){return {ok:false,reason:errors(e)};}
}
