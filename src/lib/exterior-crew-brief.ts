import type {ExtBooking,ExteriorData} from './exterior';
import type {JobContinuitySnapshot} from './exterior-job-continuity';
import type {SharedJobFollowup} from './exterior-job-followup';
import {validDay} from './exterior-job-followup';
import {originalJobMatchesTask} from './exterior-operations-inbox';
import {blockLabel,isRealPhone,parseBlock} from './exterior-ops';

/**
 * R49: a source-qualified INTERNAL crew briefing for a real booked visit.
 * This is NOT a dispatched work order, customer approval, safety clearance,
 * signed field record, invoice or bank receipt. It never writes to production.
 * Build only after the original booking, source customer and member-scoped
 * company task snapshot have been reconciled in the existing job panel.
 */
export type CrewBriefTask={
 id:string;assignee:string;stage:string;priority:'normal'|'high';
 dueDate:string;instruction:string;
};
export type CrewBrief={
 customer:string;address:string;phone:string;scope:string;
 appointment:string;bookingStatus:string;crew:string;
 quotedVisit:string;taskCoverage:'complete'|'partial';
 openTasks:number;shownTasks:readonly CrewBriefTask[];
 exceptions:readonly string[];text:string;
};
export type CrewBriefSource={
 source:{date:string;time:string|null;status:string|null};
 tasks:readonly SharedJobFollowup[];limited:boolean;
};
const line=(value:string|null|undefined,max=200):string=>
 (value??'').replace(/[\x00-\x1F\x7F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const display=(value:string|null|undefined,max=200)=>
 line(value,max)||'NOT RECORDED';
const dollars=(n:number)=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

export function buildExteriorCrewBrief(
 data:ExteriorData,booking:ExtBooking,view:JobContinuitySnapshot,
 crew:{available:boolean;employeeName:string|null},
 company:CrewBriefSource|null,
):CrewBrief|null{
 if(!company||!validDay(booking.date)||!booking.lead_id||
    !view.sourceLinked||view.leadId!==booking.lead_id||
    view.bookingId!==booking.id)return null;
 const matches=data.leads.filter(l=>l.id===booking.lead_id);
 const original=data.bookings.filter(b=>b.id===booking.id);
 if(matches.length!==1||original.length!==1||original[0].lead_id!==booking.lead_id||
    original[0].date!==booking.date||original[0].time_block!==booking.time_block||
    original[0].status!==booking.status||
    company.source.date!==booking.date||
    company.source.time!==booking.time_block||
    company.source.status!==booking.status)return null;
 const lead=matches[0];
 const customer=display(lead.name,100);
 const address=display(lead.address,180);
 const scope=display(lead.service_requested,160);
 const phone=isRealPhone(lead.phone)?display(lead.phone,40):'NOT VERIFIED';
 const appointment=display(booking.date+' • '+
  (parseBlock(booking.time_block)?blockLabel(booking.time_block):'TIME NOT VERIFIED'),100);
 const crewName=crew.available&&line(crew.employeeName,100)?
  line(crew.employeeName,100):'UNVERIFIED';
 const bookingStatus=display(booking.status,60);
 const quotedVisit=view.visitPrice!==null&&Number.isFinite(view.visitPrice)&&view.visitPrice>0?
  dollars(view.visitPrice)+' (source lead quote attributable to visit; NOT accepted or paid)':
  'NOT ATTRIBUTABLE / NOT ACCEPTED';
 const relevant=company.tasks.filter(t=>originalJobMatchesTask(t,booking)&&t.stage!=='Done');
 const ordered=[...relevant].sort((a,b)=>
  Number(a.priority!=='high')-Number(b.priority!=='high')||
  Number(a.stage!=='Review')-Number(b.stage!=='Review')||
  (a.dueDate||'9999').localeCompare(b.dueDate||'9999')||
  a.id.localeCompare(b.id));
 const shownTasks=ordered.slice(0,12).map(t=>({
  id:t.id,assignee:display(t.assignee,100),stage:display(t.stage,40),
  priority:t.priority,dueDate:display(t.dueDate,40),
  instruction:display(t.note,300),
 }));
 const exceptions:string[]=[];
 if(booking.status!=='confirmed')exceptions.push('Appointment is not confirmed: no dispatch authorization.');
 if(!parseBlock(booking.time_block))exceptions.push('Appointment time has not been validated.');
 if(customer==='NOT RECORDED')exceptions.push('Customer name absent from the original lead.');
 if(address==='NOT RECORDED')exceptions.push('Service address absent from the original lead.');
 if(scope==='NOT RECORDED')exceptions.push('Requested scope absent from the original lead.');
 if(phone==='NOT VERIFIED')exceptions.push('Customer phone is absent or unverified.');
 if(crewName==='UNVERIFIED')exceptions.push('No usable crew assignment was verified.');
 if(view.sourceCoverage!=='complete')
  exceptions.push('Loaded customer/booking history is incomplete; some source records may be absent.');
 if(company.limited)
  exceptions.push('Shared job task source is incomplete; additional assignments may exist.');
 if(ordered.length>shownTasks.length)
  exceptions.push('Only 12 of '+ordered.length+' loaded open tasks are included; open the job for the remainder.');
 if(view.visitPrice===null)
  exceptions.push('There is no safely attributable price for this visit; quote acceptance is not established.');
 const customerBlock=[
  'OJ EXTERIOR CARE — INTERNAL CREW BRIEF',
  'PLANNING ONLY • NOT DISPATCH OR SAFETY CLEARANCE',
  'Booking: '+line(booking.id,80),
  'Appointment: '+appointment,
  'Booking source status: '+bookingStatus,
  'Customer (source recorded): '+customer,
  'Service site (source recorded): '+address,
  'Contact (source recorded): '+phone,
  'Requested service (source recorded): '+scope,
  'Crew (source recorded, NOT shift acceptance): '+crewName,
  'Visit quote: '+quotedVisit,
  '',
  'OPEN INTERNAL COMPANY TASKS'+(company.limited?' (PARTIAL SOURCE)':''),
  ...(shownTasks.length?shownTasks.map((t,i)=>
   (i+1)+'. ['+t.stage+'] '+t.instruction+' — '+t.assignee+
   (t.dueDate!=='NOT RECORDED'?' • due '+t.dueDate:'')+
   (t.priority==='high'?' • high priority':'')):
   [company.limited?'No matching tasks in the loaded window; others may exist.':
    'No open tasks in the complete loaded company source.']),
  '',
  'UNRESOLVED / VERIFY BEFORE FIELD WORK',
  ...(exceptions.length?exceptions.map((s,i)=>(i+1)+'. '+s):
   ['No listed source gaps; crew/rig readiness and site-safety clearance still require independent checks.']),
  '',
  'Always verify customer permission/water, chemical PPE, runoff, equipment and site conditions.',
  'Not evidence of customer approval, site clearance, dispatched crew, completed work, invoice or payment.',
  'INTERNAL COMPANY USE ONLY — contains customer contact/site information.',
 ];
 return {
  customer,address,phone,scope,appointment,bookingStatus,
  crew:crewName,quotedVisit,taskCoverage:company.limited?'partial':'complete',
  openTasks:ordered.length,shownTasks,exceptions,
  text:customerBlock.join('\n'),
 };
}
