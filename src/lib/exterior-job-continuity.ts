import type {ExtBooking,ExtLead,ExteriorData} from './exterior';
import {quoteAttributionForBooking} from './exterior-dispatch-preflight';
import {isRealPhone,parseBlock} from './exterior-ops';

/** The operator's *source evidence*, not inferred approvals, work, pay or field completion.
 * Data comes from the original customer/booking tables. Local workbook existence
 * is deliberately NOT guessed from another screen's state.
 */
export type JobContinuityEvidence='source'|'review'|'local-only'|'not-built';
export type JobContinuityStep={
 key:'customer'|'quote'|'booking'|'crew'|'field'|'payment';
 title:string;detail:string;evidence:JobContinuityEvidence;
 route:'customer'|'estimate'|'bookings'|'field'|'finance';
};
export type JobContinuitySnapshot={
 bookingId:string;leadId:string|null;sourceLinked:boolean;
 visitPrice:number|null;status:'confirmed'|'pending'|'inactive'|'unknown';
 sourceCoverage:'complete'|'partial';
 steps:readonly JobContinuityStep[];
};
const complete=(v:{loaded:number;total:number|null}|undefined)=>
 !!v&&v.total!==null&&Number.isInteger(v.total)&&v.loaded>=v.total;
const goodText=(s:string|null|undefined)=>!!s&&!!s.trim();
export function buildJobContinuity(
 data:ExteriorData,booking:ExtBooking,
 crew:{available:boolean;employeeName:string|null},
):JobContinuitySnapshot{
 const lead:ExtLead|undefined=data.leads.find(l=>l.id===booking.lead_id);
 const linked=!!lead&&booking.lead_id===lead.id;
 const completeCoverage=complete(data.coverage?.leads)&&complete(data.coverage?.bookings);
 const attributable=linked?quoteAttributionForBooking(booking,lead,data.bookings,data):null;
 const status:JobContinuitySnapshot['status']=booking.status==='confirmed'?'confirmed':
 booking.status==='pending_approval'?'pending':
 booking.status==='denied'||booking.status==='cancelled'?'inactive':'unknown';
 const steps:JobContinuityStep[]=[
  {
   key:'customer',title:'Customer & site',route:'customer',
   evidence:linked&&goodText(lead?.name)&&goodText(lead?.address)&&goodText(lead?.service_requested)&&isRealPhone(lead?.phone??null)?'source':'review',
   detail:!linked?'Original linked customer is missing from the loaded source. Never substitute a matching name.':
    !goodText(lead?.address)?'Customer is linked, but no verified service address is recorded.':
    !goodText(lead?.service_requested)?'Customer is linked, but requested scope is incomplete.':
    !isRealPhone(lead?.phone??null)?'Customer is linked, but usable contact information is not verified.':
    'Source customer, site, requested service and contact recorded. Site survey and customer instructions are not independently verified.',
  },
  {
   key:'quote',title:'Estimate & approval',route:'estimate',
   evidence:attributable!==null?'source':'review',
   detail:attributable!==null?
    'A positive original lead quote can be uniquely attributed to this confirmed visit. NOT an immutable sent, accepted or paid proposal.':
    !completeCoverage?'Exact lead and booking history is incomplete; no visit-specific price can be attributed.':
    !linked?'Original source customer is missing; no visit-specific price is verified.':
    'Original lead quote is missing, appointment is unconfirmed, or multiple active visits share a lead. No approved visit-specific proposal exists.',
  },
  {
   key:'booking',title:'Booking & timing',route:'bookings',
   evidence:status==='confirmed'&&parseBlock(booking.time_block)?'source':'review',
   detail:status==='pending'?'Original appointment remains pending approval. Do not dispatch based on this booking.':
    status==='inactive'?'Original appointment is denied or cancelled; this is not active work.':
    status==='unknown'?'Original appointment status is not confirmed. Verify the booking before relying on it.':
    !parseBlock(booking.time_block)?'Booking is confirmed but its scheduled time block cannot be validated.':
    'Booking status and scheduled date/time are source-recorded. Crew/vehicle travel and customer reminder are not established.',
  },
  {
   key:'crew',title:'Crew & equipment',route:'bookings',
   evidence:crew.available&&goodText(crew.employeeName)?'source':'review',
   detail:!crew.available?'Crew-assignment source is unavailable or not authorized. No assumption about crew availability.':
    goodText(crew.employeeName)?'An employee assignment is recorded. It does not prove a confirmed arrival, accepted shift or rig reservation.':
    'No actual employee assignment is recorded in the accessible crew source. Fleet plans are currently device-local.',
  },
  {
   key:'field',title:'Field & owner closeout',route:'field',evidence:'local-only',
   detail:'Field hours, materials, safety, site exceptions and private owner handoff currently live in this device’s field workbench. They are NOT durable, shared, approved source work-order evidence.',
  },
  {
   key:'payment',title:'Invoice & collected funds',route:'finance',evidence:'not-built',
   detail:'A source-bound invoice/receivable/bank-matched receipt is not implemented. Historical lead revenue/cost cannot prove payment or profitability for this visit.',
  },
 ];
 return {
  bookingId:booking.id,leadId:linked?lead!.id:null,sourceLinked:linked,
  visitPrice:attributable,status,
  sourceCoverage:completeCoverage?'complete':'partial',steps,
 };
}
