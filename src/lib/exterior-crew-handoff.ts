import type {ExtBooking,ExtLead} from './exterior';
import {isFieldLog,parseFieldPackage,serializeFieldPackage,type ExteriorFieldLog} from './exterior-field-log';
import {reviewInternalCloseout} from './exterior-closeout-review';

/**
 * R35: explicitly transferred PRIVATE FILES, not a synced workflow, actor
 * authentication, customer acceptance, certified inspection or a company ledger.
 * An imported packet is untrusted until reviewed against the source and a
 * trusted delivery channel; a typed reviewer name proves no identity.
 */
export type HandoffDecision='follow-up-needed'|'reviewed-internally';
export type FollowUpOwner='crew'|'owner'|'none';
export type FieldHandoffRequest={
 format:'oj-exterior-crew-handoff';version:1;purpose:'internal-review-only';
 organization_id:string;booking_id:string;lead_id:string;
 request_id:string;issued_at:string;prepared_by:string;
 field:ExteriorFieldLog;
};
export type FieldHandoffReply={
 format:'oj-exterior-owner-reply';version:1;purpose:'internal-feedback-only';
 organization_id:string;booking_id:string;lead_id:string;
 request_id:string;request_issued_at:string;
 replied_at:string;reviewed_by:string;
 decision:HandoffDecision;follow_up_to:FollowUpOwner;
 due_on:string|null;note:string;
};
export type HandoffMailbox={
 outgoing:FieldHandoffRequest|null;incoming:FieldHandoffRequest|null;
 outgoingReply:FieldHandoffReply|null;incomingReply:FieldHandoffReply|null;
};
export const handoffFileMaxChars=115000;
export const mailboxMaxChars=245000;
const name=(v:unknown,max=80):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const id=(v:unknown):v is string=>name(v,128);
const instant=(v:unknown):v is string=>typeof v==='string'&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&
 Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&
 Number.isFinite(Date.parse(v+'T12:00:00Z'))&&
 new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,fields:readonly string[])=>Object.keys(v).every(k=>fields.includes(k));
const requestFields=[
 'format','version','purpose','organization_id','booking_id','lead_id','request_id','issued_at','prepared_by','field',
] as const;
const replyFields=[
 'format','version','purpose','organization_id','booking_id','lead_id','request_id','request_issued_at',
 'replied_at','reviewed_by','decision','follow_up_to','due_on','note',
] as const;
const unpack=(raw:string)=>{
 if(typeof raw!=='string'||!raw||raw.length>handoffFileMaxChars)
  throw Error('Private handoff file is empty or exceeds the supported limit.');
 try{return JSON.parse(raw) as unknown;}catch{throw Error('Private handoff is not valid JSON.');}
};
const fieldCopy=(org:string,value:ExteriorFieldLog,bookingId:string,leadId:string):ExteriorFieldLog=>{
 if(!isFieldLog(value,bookingId,leadId))throw Error('Field log does not match this original booking/customer.');
 return parseFieldPackage(serializeFieldPackage(org,value),org,bookingId,leadId);
};
export function parseFieldHandoffRequest(
 raw:string,org:string,bookingId:string,leadId:string,
):FieldHandoffRequest{
 const v=unpack(raw);
 if(!record(v)||!exact(v,requestFields)||
    v.format!=='oj-exterior-crew-handoff'||v.version!==1||
    v.purpose!=='internal-review-only')
  throw Error('Invalid or falsely finalized crew handoff.');
 if(v.organization_id!==org||v.booking_id!==bookingId||v.lead_id!==leadId)
  throw Error('Private crew handoff belongs to a different organization or job.');
 if(!id(v.request_id)||!instant(v.issued_at)||!name(v.prepared_by,64)||
    !isFieldLog(v.field,bookingId,leadId))
  throw Error('Crew handoff is missing a valid request ID, actor label or original field snapshot.');
 return {
  format:'oj-exterior-crew-handoff',version:1,purpose:'internal-review-only',
  organization_id:org,booking_id:bookingId,lead_id:leadId,
  request_id:v.request_id,issued_at:v.issued_at,prepared_by:v.prepared_by.trim(),
  field:fieldCopy(org,v.field,bookingId,leadId),
 };
}
export function createFieldHandoffRequest(
 org:string,booking:ExtBooking,lead:ExtLead,field:ExteriorFieldLog,
 preparedBy:string,requestId:string,issuedAt=new Date(),
):FieldHandoffRequest{
 if(!id(org)||!id(requestId)||booking.lead_id!==lead.id||
    !Number.isFinite(issuedAt.getTime())||!name(preparedBy,64))
  throw Error('A valid exact source booking, author label and new request ID are required.');
 const draft={
  format:'oj-exterior-crew-handoff',version:1,purpose:'internal-review-only',
  organization_id:org,booking_id:booking.id,lead_id:lead.id,
  request_id:requestId,issued_at:issuedAt.toISOString(),prepared_by:preparedBy.trim(),
  field:fieldCopy(org,field,booking.id,lead.id),
 };
 return parseFieldHandoffRequest(JSON.stringify(draft),org,booking.id,lead.id);
}
export function parseFieldHandoffReply(
 raw:string,org:string,bookingId:string,leadId:string,
 request:FieldHandoffRequest,
):FieldHandoffReply{
 const v=unpack(raw);
 if(!record(v)||!exact(v,replyFields)||
    v.format!=='oj-exterior-owner-reply'||v.version!==1||
    v.purpose!=='internal-feedback-only')
  throw Error('Invalid, unsupported or falsely finalized owner reply.');
 if(v.organization_id!==org||v.booking_id!==bookingId||v.lead_id!==leadId||
    request.organization_id!==org||request.booking_id!==bookingId||request.lead_id!==leadId)
  throw Error('Owner reply belongs to a different organization or job.');
 if(v.request_id!==request.request_id||v.request_issued_at!==request.issued_at)
  throw Error('Owner reply references a different handoff revision; it was not applied.');
 if(instant(v.replied_at)&&Date.parse(v.replied_at)<Date.parse(request.issued_at))
  throw Error('Owner reply predates the original crew handoff request.');
 if(!instant(v.replied_at)||!name(v.reviewed_by,64)||
    (v.decision!=='follow-up-needed'&&v.decision!=='reviewed-internally')||
    (v.follow_up_to!=='crew'&&v.follow_up_to!=='owner'&&v.follow_up_to!=='none')||
    !(v.due_on===null||date(v.due_on))||
    typeof v.note!=='string'||v.note.length>1500)
  throw Error('Owner reply contains invalid feedback, dates or decision.');
 if(v.decision==='follow-up-needed'&&
    (v.follow_up_to==='none'||v.note.trim().length<10))
  throw Error('Follow-up needs a named responsible side and a useful action note.');
 if(v.decision==='reviewed-internally'&&v.follow_up_to!=='none')
  throw Error('Internal review without follow-up cannot create an untracked assignment.');
 if(v.follow_up_to==='none'&&v.due_on!==null)
  throw Error('Due date requires an actual internal follow-up assignment.');
 return {
  format:'oj-exterior-owner-reply',version:1,purpose:'internal-feedback-only',
  organization_id:org,booking_id:bookingId,lead_id:leadId,
  request_id:request.request_id,request_issued_at:request.issued_at,
  replied_at:v.replied_at,reviewed_by:v.reviewed_by.trim(),
  decision:v.decision,follow_up_to:v.follow_up_to,
  due_on:v.due_on,note:v.note.trim(),
 };
}
export function createFieldHandoffReply(
 request:FieldHandoffRequest,booking:ExtBooking,lead:ExtLead,
 allBookings:readonly ExtBooking[],coverageComplete:boolean,
 values:{reviewedBy:string;decision:HandoffDecision;followUpTo:FollowUpOwner;dueOn:string|null;note:string},
 repliedAt=new Date(),
):FieldHandoffReply{
 if(!Number.isFinite(repliedAt.getTime())||booking.id!==request.booking_id||
    lead.id!==request.lead_id||booking.lead_id!==lead.id)
  throw Error('Owner reply must retain the exact source booking and customer.');
 const evaluation=reviewInternalCloseout(booking,lead,allBookings,request.field,coverageComplete);
 if(values.decision==='reviewed-internally'&&!evaluation.reviewable)
  throw Error('Unresolved source, cost or safety blockers prevent a clear internal field review.');
 const data={
  format:'oj-exterior-owner-reply',version:1,purpose:'internal-feedback-only',
  organization_id:request.organization_id,booking_id:request.booking_id,lead_id:request.lead_id,
  request_id:request.request_id,request_issued_at:request.issued_at,
  replied_at:repliedAt.toISOString(),reviewed_by:values.reviewedBy,
  decision:values.decision,follow_up_to:values.followUpTo,
  due_on:values.dueOn,note:values.note,
 };
 return parseFieldHandoffReply(JSON.stringify(data),request.organization_id,booking.id,lead.id,request);
}
export const newHandoffMailbox=():HandoffMailbox=>({
 outgoing:null,incoming:null,outgoingReply:null,incomingReply:null,
});
export function readHandoffMailbox(raw:string|null,org:string,bookingId:string,leadId:string):HandoffMailbox{
 if(raw===null)return newHandoffMailbox();
 if(!raw||raw.length>mailboxMaxChars)throw Error('Stored handoff mailbox is invalid or too large.');
 let data:unknown;
 try{data=JSON.parse(raw);}catch{throw Error('Stored handoff mailbox cannot be decoded.');}
 const fields=['schema','outgoing','incoming','outgoingReply','incomingReply'] as const;
 if(!record(data)||!exact(data,fields)||fields.some(k=>!Object.prototype.hasOwnProperty.call(data,k))||
    data.schema!==1)
  throw Error('Stored handoff mailbox schema is invalid; original data was preserved.');
 const outgoing=data.outgoing===null?null:parseFieldHandoffRequest(
  JSON.stringify(data.outgoing),org,bookingId,leadId);
 const incoming=data.incoming===null?null:parseFieldHandoffRequest(
  JSON.stringify(data.incoming),org,bookingId,leadId);
 if(data.outgoingReply!==null&&!incoming)throw Error('Orphaned owner reply has no imported crew request.');
 if(data.incomingReply!==null&&!outgoing)throw Error('Orphaned crew feedback has no matching exported request.');
 const outgoingReply=data.outgoingReply===null?null:parseFieldHandoffReply(
  JSON.stringify(data.outgoingReply),org,bookingId,leadId,incoming!);
 const incomingReply=data.incomingReply===null?null:parseFieldHandoffReply(
  JSON.stringify(data.incomingReply),org,bookingId,leadId,outgoing!);
 return {outgoing,incoming,outgoingReply,incomingReply};
}
export function serializeHandoffMailbox(
 state:HandoffMailbox,org:string,bookingId:string,leadId:string,
):string{
 const value={
  schema:1,
  outgoing:state.outgoing,incoming:state.incoming,
  outgoingReply:state.outgoingReply,incomingReply:state.incomingReply,
 };
 const raw=JSON.stringify(value);
 if(raw.length>mailboxMaxChars)throw Error('Mailbox exceeds safe browser storage limits.');
 readHandoffMailbox(raw,org,bookingId,leadId);
 return raw;
}
export function handoffRevisionMatchesField(request:FieldHandoffRequest,field:ExteriorFieldLog):boolean{
 return isFieldLog(field,request.booking_id,request.lead_id)&&
  JSON.stringify(request.field)===JSON.stringify(field);
}


/** 
 * An owner reply imported later is NOT a durable signoff. Re-check its
 * "reviewed internally" claim against today's actual authorized booking
 * window and the ORIGINAL field snapshot, not a subsequently edited draft.
 */
export function replyReviewStillCurrent(
 request:FieldHandoffRequest,reply:FieldHandoffReply,
 booking:ExtBooking,lead:ExtLead,allBookings:readonly ExtBooking[],
 bookingCoverageComplete:boolean,
):boolean{
 if(request.organization_id!==reply.organization_id||
    request.booking_id!==reply.booking_id||
    request.lead_id!==reply.lead_id||
    request.request_id!==reply.request_id||
    request.issued_at!==reply.request_issued_at||
    booking.id!==request.booking_id||lead.id!==request.lead_id)
  return false;
 if(reply.decision==='follow-up-needed')return true;
 try{return reviewInternalCloseout(
  booking,lead,allBookings,request.field,bookingCoverageComplete,
 ).reviewable;}catch{return false;}
}
