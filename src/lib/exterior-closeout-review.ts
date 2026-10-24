import type {ExtBooking,ExtLead} from './exterior';
import {fieldSourceMatches,isFieldLog,reviewFieldLog,type ExteriorFieldLog,type FieldCostReview} from './exterior-field-log';

/**
 * Read-only, exact-booking INTERNAL closeout preparation. Never changes
 * booking status, produces a customer invoice or attests to completed work.
 * A locally complete review still requires independent source verification.
 */
export type CloseoutFinding={
 code:string;label:string;location:string;
};
export type InternalCloseoutReview={
 bookingId:string;leadId:string;sourceCurrent:boolean;bookingCoverageComplete:boolean;
 bookingUnique:boolean;fieldCost:FieldCostReview|null;
 blockers:CloseoutFinding[];cautions:string[];
 reviewable:boolean;quoteAmount:number|null;hoursReviewed:number|null;
};
const validQuote=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1e7;
const active=(b:ExtBooking)=>b.status!=='cancelled'&&b.status!=='denied';
const money=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

export function reviewInternalCloseout(
 booking:ExtBooking,lead:ExtLead,allBookings:readonly ExtBooking[],
 field:ExteriorFieldLog|null,bookingCoverageComplete:boolean,
):InternalCloseoutReview{
 if(!booking.id||!lead.id||booking.lead_id!==lead.id)throw Error('Exact booking and source lead disagree.');
 const blockers:CloseoutFinding[]=[];
 const cautions:string[]=[];
 const add=(code:string,label:string,location:string)=>blockers.push({code,label,location});
 const sourceCurrent=allBookings.some(b=>b.id===booking.id&&b.lead_id===lead.id&&
  b.date===booking.date&&b.status===booking.status);
 const activeCount=allBookings.filter(b=>b.lead_id===lead.id&&active(b)).length;
 const bookingUnique=bookingCoverageComplete&&activeCount===1&&active(booking);
 if(!bookingCoverageComplete)add('source-coverage','Booking source is incomplete; another visit may be missing.','bookings');
 if(!sourceCurrent)add('source-missing','This booking is absent or changed in the loaded source.','bookings');
 if(!active(booking))add('booking-inactive','Original booking is cancelled or denied.','bookings');
 if(activeCount!==1)add('multiple-visits',activeCount===0?
  'No active visit is associated with this original lead.':
  'This lead has multiple active visits; its quote is not booking-specific.','bookings');
 if(!field||!isFieldLog(field,booking.id,lead.id)){
  add('field-missing','No valid exact-booking field draft is available.','status');
  return {bookingId:booking.id,leadId:lead.id,sourceCurrent,bookingCoverageComplete,bookingUnique,
   fieldCost:null,blockers,cautions,reviewable:false,
   quoteAmount:validQuote(lead.quote_amount)?lead.quote_amount:null,hoursReviewed:null};
 }
 if(!fieldSourceMatches(field,booking))add('field-stale','Local field entry uses an older booking date/status.','status');
 const fieldCost=reviewFieldLog(field);
 if(field.stage!=='wrap-up')add('stage','Move the local field stage to post-job review only after actual work.','status');
 if(!field.arrivalAt||!field.departureAt)add('time','Operator-entered arrival/departure timestamps are incomplete.','status');
 if(!field.review.labor||field.labor.some(x=>x.hours===null||x.hourlyCost===null))
  add('labor','Review crew time and estimated loaded rates (including genuine zeros).','labor');
 if(!field.review.materials||field.materials.some(x=>x.quantity===null||x.unitCost===null))
  add('materials','Review consumables and unit costs (including genuine zeros).','materials');
 if(!field.review.travel||field.travelMiles===null||field.vehicleCostPerMile===null)
  add('travel','Review travel mileage and per-mile cost.','travel');
 if(!field.review.other||field.otherDirectCost===null)
  add('other','Review additional direct costs, entering zero only if verified none.','travel');
 const safetyKeys=['water','ppe','runoff','chemicals','pump','hoses','pureWater'] as const;
 for(const key of safetyKeys){
  if(field.checks[key]==='not-checked')add('check-'+key,key+' checklist has not been reviewed.','safety');
  if(field.checks[key]==='issue')add('issue-'+key,key+' checklist records an unresolved concern.','safety');
 }
 const unresolved=field.issues.filter(i=>!i.resolved);
 if(unresolved.some(i=>i.severity==='stop-work'))
  add('stop-work','Unresolved STOP-WORK observation must be addressed.','issues');
 if(unresolved.some(i=>i.severity==='attention'))
  add('open-issues','Unresolved attention-level operational observations require review.','issues');
 if(unresolved.some(i=>i.severity==='note'))
  cautions.push('Open note-level observations are still in the local field log.');
 if(!field.siteNotes.trim())cautions.push('No site notes were entered; supporting observations may be incomplete.');
 if(!validQuote(lead.quote_amount))
  cautions.push('No positive source lead quote is available; proposed billing value is unknown.');
 else cautions.push('Original lead quote is NOT evidence of customer approval, visit-specific pricing or cash.');
 if(lead.job_revenue!==null||lead.job_cost!==null)
  cautions.push('Legacy lead-level revenue/cost is not assigned to this booking or confirmed as paid.');
 cautions.push('No signed scope, customer approval, photo proof, invoice, bank receipt, or owner sign-off was verified by this browser-only review.');
 const hoursReviewed=field.review.labor&&field.labor.every(r=>r.hours!==null)?
  Math.round(field.labor.reduce((sum,row)=>sum+(row.hours??0),0)*100)/100:null;
 return {bookingId:booking.id,leadId:lead.id,sourceCurrent,bookingCoverageComplete,bookingUnique,
  fieldCost,blockers,cautions,reviewable:blockers.length===0,
  quoteAmount:validQuote(lead.quote_amount)?lead.quote_amount:null,hoursReviewed};
}

/** Human-readable INTERNAL clipboard packet only; no authoritative status fields. */
export function internalCloseoutBrief(review:InternalCloseoutReview,lead:ExtLead,booking:ExtBooking):string{
 if(review.bookingId!==booking.id||review.leadId!==lead.id||booking.lead_id!==lead.id)
  throw Error('Internal closeout identities disagree.');
 return [
  'OJ EXTERIOR CARE — PRIVATE FIELD CLOSEOUT REVIEW',
  'INTERNAL DRAFT ONLY — NOT A COMPLETED JOB, ACCEPTED PROPOSAL, INVOICE, CUSTOMER SIGNOFF OR PAYMENT',
  'Booking ID: '+booking.id,
  'Source lead ID: '+lead.id,
  'Customer: '+(lead.name??'Unknown'),
  'Service site: '+(lead.address??'Unknown'),
  'Original booking: '+booking.date+' · '+(booking.status??'status unknown'),
  'Booking source complete: '+(review.bookingCoverageComplete?'Yes':'Unknown/incomplete'),
  'Field source current: '+(review.sourceCurrent?'Original record visible':'Unverified'),
  'Single active visit: '+(review.bookingUnique?'Proven in loaded complete source':'Not proven'),
  'Internal field review: '+(review.reviewable?'No outstanding draft blockers':'BLOCKED / ACTION REQUIRED'),
  'Original lead quote (not accepted): '+money(review.quoteAmount),
  'Operator-entered crew hours: '+(review.hoursReviewed===null?'Unknown':review.hoursReviewed+' h'),
  'Operator-entered direct costs (NOT settled): '+money(review.fieldCost?.totalDirectCost??null),
  '',
  'REMAINING FIELD ACTIONS:',
  ...(review.blockers.length?review.blockers.map(x=>'- '+x.label):['- No local field blockers detected; independent customer and financial validation still required.']),
  '',
  'UNVERIFIED SOURCE/APPROVAL FACTS:',
  ...review.cautions.map(x=>'- '+x),
  '',
  'This packet was created locally by an operator. Verify source records, actual completion, authorized charges, customer acceptance and collection in separate systems.',
 ].join('\n');
}
