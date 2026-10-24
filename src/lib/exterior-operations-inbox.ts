import type {Card} from './board';
import type {ExtBooking,ExtLead} from './exterior';
import {parseJobFollowupReceipt,projectJobFollowup,type SharedJobFollowup,validDay} from './exterior-job-followup';

/** R38: signed-in company-task projection, NOT a source of crew hours, safety
 * clearance, accepted quote, booked work completion, invoice or payment.
 *
 * Every displayed link starts as a member-editable task receipt; the server must
 * separately load original bookings and their linked leads with user-scoped RLS.
 */
export type InboxFilter='mine'|'all'|'overdue'|'review'|'source-changed'|'today';
export type InboxSource='current'|'changed'|'unavailable';
export type InboxTiming='overdue'|'today'|'future'|'none';
export type ExteriorInboxItem={
 task:SharedJobFollowup;
 bookingId:string;leadId:string;customer:string;service:string;
 source:InboxSource;sourceDetail:string;
 actualBookingDate:string|null;actualBookingStatus:string|null;
 timing:InboxTiming;isMine:boolean;isOpen:boolean;
};
export type ExteriorInboxTotals={
 visible:number;active:number;mine:number;overdue:number;review:number;
 sourceChanged:number;dueToday:number;highPriority:number;
};
export type ExteriorInboxReport={
 items:ExteriorInboxItem[];totals:ExteriorInboxTotals;today:string;
 partial:boolean;sourceCount:number|null;returnedCount:number;scannedCount:number;
 identity:'unique'|'ambiguous'|'unknown';myName:string|null;
};
const clean=(s:string|null|undefined,max=140)=>{
 if(!s||!s.trim())return null;
 return s.trim().slice(0,max);
};
export function originalJobMatchesTask(task:Pick<SharedJobFollowup,'sourceDate'|'sourceTime'|'sourceStatus'>,booking:ExtBooking):boolean{
 return task.sourceDate===booking.date&&task.sourceTime===booking.time_block&&
 task.sourceStatus===booking.status&&booking.status!=='denied'&&booking.status!=='cancelled';
}
export function inboxTiming(date:string,today:string,done:boolean):InboxTiming{
 if(done||!validDay(date)||!validDay(today))return 'none';
 return date<today?'overdue':date===today?'today':'future';
}
export function selectExteriorInbox(items:readonly ExteriorInboxItem[],focus:InboxFilter):ExteriorInboxItem[]{
 const result=items.filter(x=>focus==='all'||
  (focus==='mine'&&x.isMine)||
  (focus==='overdue'&&x.timing==='overdue')||
  (focus==='today'&&x.timing==='today')||
  (focus==='review'&&x.isOpen&&x.task.stage==='Review')||
  (focus==='source-changed'&&x.isOpen&&x.source!=='current'));
 return [...result].sort((a,b)=>{
  const weight=(x:ExteriorInboxItem)=>{
   if(!x.isOpen)return 99;
   if(x.source!=='current')return 0;
   if(x.timing==='overdue')return 1;
   if(x.task.stage==='Review')return 2;
   if(x.timing==='today')return 3;
   if(x.task.priority==='high')return 4;
   return 5;
  };
  return weight(a)-weight(b)||
   (a.task.dueDate||'9999').localeCompare(b.task.dueDate||'9999')||
   a.task.id.localeCompare(b.task.id);
 });
}
export function buildExteriorOperationsInbox(
 org:string,cards:readonly Card[],bookings:readonly ExtBooking[],leads:readonly ExtLead[],
 displayName:string|null,displayNameMatches:number,today:string,
 sourceCount:number|null,
):ExteriorInboxReport{
 if(!validDay(today))throw Error('A valid local business date is required before classifying team tasks.');
 const identity=displayNameMatches===1?'unique':displayNameMatches>1?'ambiguous':'unknown';
 const myName=identity==='unique'?displayName:null;
 const bookingMap=new Map(bookings.map(b=>[b.id,b]));
 const leadMap=new Map(leads.map(l=>[l.id,l]));
 const tasks:ExteriorInboxItem[]=[];
 let scannedCount=0;
 for(const c of cards){
  if(c.organization_id!==org||c.business!=='exterior')continue;
  const receipt=parseJobFollowupReceipt(c.description);
  if(!receipt||receipt.organizationId!==org)continue;
  scannedCount++;
  const task=projectJobFollowup(c,org,receipt.bookingId,receipt.leadId);
  if(!task)continue;
  const booking=bookingMap.get(receipt.bookingId);
  const lead=leadMap.get(receipt.leadId);
  const correctPair=!!booking&&booking.lead_id===receipt.leadId&&!!lead;
  const source:InboxSource=!correctPair?'unavailable':
   originalJobMatchesTask(task,booking)?'current':'changed';
  const sourceDetail=source==='unavailable'?
   'Original booking and linked customer were not both verified from the authorized source.':
   source==='changed'?
    'Original booking day, time or status changed or was cancelled. Recheck before updating this task.':
    'Original booking and customer identity currently match the recorded task source snapshot.';
  const isOpen=task.stage!=='Done';
  tasks.push({
   task,bookingId:receipt.bookingId,leadId:receipt.leadId,
   customer:correctPair?clean(lead?.name,100)??'Customer name unrecorded':'Source customer unavailable',
   service:correctPair?clean(lead?.service_requested,120)??'Service not entered':'Original service unavailable',
   source,sourceDetail,actualBookingDate:correctPair?booking.date:null,
   actualBookingStatus:correctPair?booking.status:null,
   timing:inboxTiming(task.dueDate,today,!isOpen),
   isMine:!!myName&&task.assignee===myName,isOpen,
  });
 }
 const totals:ExteriorInboxTotals={
  visible:tasks.length,active:tasks.filter(x=>x.isOpen).length,
  mine:tasks.filter(x=>x.isOpen&&x.isMine).length,
  overdue:tasks.filter(x=>x.timing==='overdue').length,
  review:tasks.filter(x=>x.isOpen&&x.task.stage==='Review').length,
  sourceChanged:tasks.filter(x=>x.isOpen&&x.source!=='current').length,
  dueToday:tasks.filter(x=>x.timing==='today').length,
  highPriority:tasks.filter(x=>x.isOpen&&x.task.priority==='high').length,
 };
 return {
  items:selectExteriorInbox(tasks,'all'),totals,today,myName,
  identity,scannedCount,returnedCount:cards.length,sourceCount,
  partial:sourceCount===null||sourceCount>cards.length,
 };
}
