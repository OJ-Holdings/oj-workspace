import type {Card,Stage} from './board';
import type {ExtBooking} from './exterior';

/**
 * R37: shared, authenticated COMPANY TASKS on the existing oj_cards board.
 * This is intentionally NOT a synced field worksheet, protected quote version,
 * certified owner review, employee timesheet, invoice or paid job.
 *
 * The receipt is a structured LINK HINT in editable task text; it is not a
 * relational FK or tamper-proof provenance claim. Server actions must re-check
 * org membership and exact original booking/lead on EVERY read/write.
 */
export type FollowupOrigin='manual-job-task'|'private-owner-reply-reference';
export type FollowupStage=Extract<Stage,'Ready'|'In progress'|'Review'|'Done'>;
export type NewJobFollowup={
 taskId:string;sourceDate:string;sourceTime:string|null;sourceStatus:string|null;
 leadId:string;assignee:string;note:string;dueOn:string;priority:'normal'|'high';
 origin:FollowupOrigin;handoffRequestId:string|null;
};
export type JobFollowupReceipt={
 organizationId:string;bookingId:string;leadId:string;
 sourceDate:string;sourceTime:string|null;sourceStatus:string|null;
 origin:FollowupOrigin;handoffRequestId:string|null;
 note:string;
};
export type JobSourceSnapshot={date:string;time:string|null;status:string|null};
export type SharedJobFollowup={
 id:string;title:string;assignee:string;stage:Stage;priority:'normal'|'high';
 dueDate:string;revision:number;createdAt:string;updatedAt:string;
 note:string;origin:FollowupOrigin;handoffRequestId:string|null;
 sourceDate:string;sourceTime:string|null;sourceStatus:string|null;
};
/** R46: distinguish raw scoped query windows from validated job tasks.
 * A page's raw scanned count may exceed its number of valid task receipts. */
export type OlderJobTaskPage={
 tasks:SharedJobFollowup[];source:JobSourceSnapshot;
 offset:number;scanned:number;total:number|null;
};
export type JobTaskWindow={
 tasks:SharedJobFollowup[];source:JobSourceSnapshot;
 taskWindow:number;taskTotal:number|null;limited:boolean;
};
/** Pagination is only safe on full-size prior pages with a stable offset.
 * Partial or unknown count still means incomplete evidence; it does not
 * authorize requesting arbitrary offsets or claiming history exhaustion. */
export function canPageSourceWindow(
 scanned:number,total:number|null,pageSize:50|100,cap=1000,
):boolean{
 return Number.isInteger(scanned)&&scanned>=pageSize&&scanned%pageSize===0&&
  scanned<cap&&(total===null||scanned<total);
}
export function mergeOlderJobTasks<T extends JobTaskWindow>(current:T,page:OlderJobTaskPage):T{
 if(page.offset!==current.taskWindow||page.total!==current.taskTotal||
  page.source.date!==current.source.date||page.source.time!==current.source.time||
  page.source.status!==current.source.status)
  throw Error('Company job source changed while loading earlier tasks. Refresh the original job.');
 if(!Number.isInteger(page.scanned)||page.scanned<1||page.scanned>100||
    current.taskWindow<0||current.taskWindow>=1000||
    current.taskWindow+page.scanned>1000||
    (page.total!==null&&current.taskWindow+page.scanned>page.total))
  throw Error('Task page is incomplete or outside the bounded source window. Refresh.');
 const ids=new Set(current.tasks.map(t=>t.id));
 for(const task of page.tasks){
  if(ids.has(task.id))throw Error('Overlapping company task pages detected. Refresh before acting.');
  ids.add(task.id);
 }
 const taskWindow=current.taskWindow+page.scanned;
 return {...current,tasks:[...current.tasks,...page.tasks],
  taskWindow,limited:!sourceWindowComplete(page.total,taskWindow,1000)};
}
export const allowedFollowupStages:readonly FollowupStage[]=['Ready','In progress','Review','Done'];
const mark='OJ_EXTERIOR_JOB_FOLLOWUP_V1';
const actionMarker='ACTION:\n';
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validDay=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&
 Number.isFinite(Date.parse(v+'T12:00:00Z'))&&
 new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const safeSingle=(v:string|null,max=90)=>v===null||(
 v.length<=max&&!/[\r\n\x00-\x1F]/.test(v)
);
/** Server-and-client policy: pending approval allows INTERNAL review tasks only. */
export const actionableJobStatus=(v:string|null):boolean=>
 v==='confirmed'||v==='pending_approval';
/** Exact-count source windows must not silently masquerade as exhaustive. */
export function sourceWindowComplete(total:number|null,received:number,limit:number):boolean{
 return total!==null&&Number.isInteger(total)&&total>=0&&total<=limit&&
  received===total;
}
const request=(v:unknown):v is string=>typeof v==='string'&&uuid.test(v);
export function validateJobFollowup(
 org:string,booking:ExtBooking,input:NewJobFollowup,
):NewJobFollowup{
 if(!request(org)||!request(booking.id)||!request(input.leadId)||booking.lead_id!==input.leadId)
  throw Error('A real, exact organization, booking and customer identity is required.');
 if(!request(input.taskId))throw Error('The shared task needs a valid unique identifier.');
 // Reject injected separators before interpreting the booking state itself.
 if(!safeSingle(booking.time_block,50)||!safeSingle(booking.status,50))
  throw Error('The original booking time or status is not safely formatted.');
 if(!actionableJobStatus(booking.status))throw Error('This original booking is no longer active; refresh the source.');
 if(!validDay(booking.date)||!validDay(input.sourceDate)||
   booking.date!==input.sourceDate||booking.time_block!==input.sourceTime||
   booking.status!==input.sourceStatus)
  throw Error('The original booking date, time or status changed. Refresh before publishing.');
 if(typeof input.note!=='string'||input.note.trim().length<10||input.note.length>1200||
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(input.note))
  throw Error('Write a specific internal next action of 10 to 1200 characters.');
 if(typeof input.assignee!=='string'||input.assignee.length>120||!input.assignee.trim()||
    /[\r\n\x00-\x1F]/.test(input.assignee))
  throw Error('Choose a current company member to own this follow-up.');
 if(!['normal','high'].includes(input.priority))throw Error('Select a valid urgency.');
 if(input.dueOn!==''&&!validDay(input.dueOn))throw Error('Follow-up date is invalid.');
 if(input.origin!=='manual-job-task'&&input.origin!=='private-owner-reply-reference')
  throw Error('Unknown follow-up source.');
 if(input.origin==='private-owner-reply-reference'&&!request(input.handoffRequestId))
  throw Error('The imported private reply must have a valid request identifier.');
 if(input.origin==='manual-job-task'&&input.handoffRequestId!==null)
  throw Error('Manually entered actions cannot claim to be an imported owner reply.');
 return {...input,note:input.note.trim(),assignee:input.assignee.trim()};
}
export function buildJobFollowupDescription(
 org:string,booking:ExtBooking,input:NewJobFollowup,
):string{
 const x=validateJobFollowup(org,booking,input);
 return [
  mark,'Organization ID: '+org,'Exterior booking ID: '+booking.id,
  'Exterior lead ID: '+x.leadId,'Source booking day: '+booking.date,
  'Source booking time: '+(booking.time_block??'NONE'),
  'Source booking status: '+(booking.status??'NONE'),
  'Origin: '+x.origin,'Local handoff request: '+(x.handoffRequestId??'NONE'),
  '',
  'INTERNAL SHARED COMPANY TASK — not proof of completed work,',
  'customer consent, source price acceptance, reviewed payroll or payment.',
  'Private field notes and labor/cost files remain on their originating device.',
  '',
  actionMarker+x.note,
 ].join('\n');
}
export function parseJobFollowupReceipt(value:unknown):JobFollowupReceipt|null{
 if(typeof value!=='string'||value.length>8000)return null;
 const parts=value.split('\n');
 if(parts.length<15||parts[0]!==mark)return null;
 const field=(n:number,prefix:string)=>{
  const s=parts[n];return typeof s==='string'&&s.startsWith(prefix)?s.slice(prefix.length):null;
 };
 const organizationId=field(1,'Organization ID: ');
 const bookingId=field(2,'Exterior booking ID: ');
 const leadId=field(3,'Exterior lead ID: ');
 const sourceDate=field(4,'Source booking day: ');
 const rawTime=field(5,'Source booking time: ');
 const rawStatus=field(6,'Source booking status: ');
 const origin=field(7,'Origin: ');
 const rawRequest=field(8,'Local handoff request: ');
 const idx=value.indexOf('\n'+actionMarker);
 const note=idx>=0?value.slice(idx+1+actionMarker.length):'';
 if(!request(organizationId)||!request(bookingId)||!request(leadId)||
    !validDay(sourceDate)||rawTime===null||rawStatus===null||rawRequest===null||
    (origin!=='manual-job-task'&&origin!=='private-owner-reply-reference')||
    (rawRequest!=='NONE'&&!request(rawRequest))||
    (origin==='private-owner-reply-reference'&&rawRequest==='NONE')||
    (origin==='manual-job-task'&&rawRequest!=='NONE')||
    note.trim().length<10||note.length>1200)return null;
 const sourceTime=rawTime==='NONE'?null:rawTime;
 const sourceStatus=rawStatus==='NONE'?null:rawStatus;
 if(!safeSingle(sourceTime,50)||!safeSingle(sourceStatus,50))return null;
 return {
  organizationId,bookingId,leadId,sourceDate,sourceTime,sourceStatus,
  origin,handoffRequestId:rawRequest==='NONE'?null:rawRequest,note,
 };
}
export function isJobFollowupFor(
 description:unknown,org:string,bookingId:string,leadId:string,
):boolean{
 const p=parseJobFollowupReceipt(description);
 return !!p&&p.organizationId===org&&p.bookingId===bookingId&&p.leadId===leadId;
}
export function projectJobFollowup(
 row:Card&{created_at?:string;updated_at?:string},
 org:string,bookingId:string,leadId:string,
):SharedJobFollowup|null{
 if(row.organization_id!==org||row.business!=='exterior'||
    !isJobFollowupFor(row.description,org,bookingId,leadId))return null;
 const source=parseJobFollowupReceipt(row.description)!;
 return {
  id:row.id,title:row.title,assignee:row.assignee,stage:row.stage,
  priority:row.priority,dueDate:row.due_date??'',revision:row.revision,
  createdAt:row.created_at??'',updatedAt:row.updated_at??'',
  note:source.note,origin:source.origin,handoffRequestId:source.handoffRequestId,
  sourceDate:source.sourceDate,sourceTime:source.sourceTime,sourceStatus:source.sourceStatus,
 };
}
/** Idempotent create retries must match ALL immutable proposal fields. A changed
 * assignee, deadline, or note requires a fresh UUID instead of falsely
 * reporting that earlier work was saved with the new instructions. */
export function sameJobFollowupAttempt(
 previous:SharedJobFollowup,input:NewJobFollowup,
):boolean{
 return previous.origin===input.origin&&previous.handoffRequestId===input.handoffRequestId&&
  previous.sourceDate===input.sourceDate&&previous.sourceTime===input.sourceTime&&
  previous.sourceStatus===input.sourceStatus&&previous.note===input.note.trim()&&
  previous.assignee===input.assignee.trim()&&previous.priority===input.priority&&
  previous.dueDate===input.dueOn;
}
export function makeJobFollowupCard(org:string,booking:ExtBooking,input:NewJobFollowup):Card{
 const x=validateJobFollowup(org,booking,input);
 return {
  id:x.taskId,organization_id:org,
  title:'Exterior job follow-up • '+booking.date,
  description:buildJobFollowupDescription(org,booking,x),business:'exterior',
  stage:'Ready',priority:x.priority,assignee:x.assignee,due_date:x.dueOn,
  revision:0,checklist:[],
 };
}
