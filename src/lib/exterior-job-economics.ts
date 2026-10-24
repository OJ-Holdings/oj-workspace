import type {ExtBooking,ExtLead} from './exterior';
import {
 computeExteriorEstimate,isExteriorEstimate,sourceStillMatches,
 type ExteriorEstimate,type ExteriorEstimateTotals,
} from './exterior-estimate';
import {
 fieldSourceMatches,reviewFieldLog,isFieldLog,
 type ExteriorFieldLog,type FieldCostReview,
} from './exterior-field-log';

/**
 * Read-only analysis from exact-source legacy booking/lead plus optional
 * device-local estimate and field log. No invoice/payment/approval or booking
 * assignment is created or inferred.
 */
export type JobEconomicsReview={
 bookingId:string;leadId:string;
 sourceBookingCount:number;sourceBookingCurrent:boolean;bookingCoverageComplete:boolean;
 quoteAmount:number|null;quoteAccepted:'unverified';
 localEstimateAvailable:boolean;estimateSourceCurrent:boolean;
 planned:ExteriorEstimateTotals|null;field:FieldCostReview|null;
 fieldSourceCurrent:boolean;fieldHoursReviewed:number|null;
 quoteLessFieldCost:number|null;quoteLessFieldCostRatio:number|null;
 plannedCostMinusFieldCost:number|null;
 comparable:boolean;comparisonReasons:string[];warnings:string[];
};
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const known=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e7;

export function reviewJobEconomics(
 booking:ExtBooking,lead:ExtLead,allBookings:readonly ExtBooking[],
 field:ExteriorFieldLog|null,estimate:ExteriorEstimate|null,bookingCoverageComplete=false,
):JobEconomicsReview{
 if(booking.lead_id!==lead.id)throw Error('Booking is not linked to this exact customer.');
 const count=allBookings.filter(b=>b.lead_id===lead.id&&b.status!=='cancelled'&&b.status!=='denied').length;
 const sourceBookingCurrent=allBookings.some(b=>b.id===booking.id&&b.lead_id===lead.id&&
   b.date===booking.date&&b.status===booking.status);
 const quoteAmount=known(lead.quote_amount)?lead.quote_amount:null;
 const localEstimateAvailable=estimate!==null;
 const estimateSourceCurrent=!!estimate&&isExteriorEstimate(estimate,lead.id)&&sourceStillMatches(estimate,lead);
 const planned=estimate&&isExteriorEstimate(estimate,lead.id)?computeExteriorEstimate(estimate):null;
 const fieldValid=field!==null&&isFieldLog(field,booking.id,lead.id);
 const fieldSourceCurrent=Boolean(fieldValid&&field&&fieldSourceMatches(field,booking));
 const reviewed=fieldValid&&field?reviewFieldLog(field):null;
 const fieldHoursReviewed=fieldValid&&field?.review.labor&&field.labor.every(l=>l.hours!==null)
  ?cents(field.labor.reduce((sum,l)=>sum+(l.hours??0),0)):null;
 const reasons:string[]=[];
 if(!bookingCoverageComplete)reasons.push('Authorized booking result is truncated or its total count is unknown; unique visit attribution is not proven.');
 if(!sourceBookingCurrent)reasons.push('Original booking source is no longer in the currently loaded matching snapshot.');
 if(count!==1)reasons.push(count>1?
   'This original lead has multiple non-cancelled bookings; its quoted amount cannot be assigned to this particular visit.':
   'There is no uniquely associated active booking in the loaded source.');
 if(!fieldSourceCurrent)reasons.push('Local field report is missing or its booking source date/status has changed.');
 if(!reviewed?.complete)reasons.push('All four categories of operator-entered direct cost have not been reviewed.');
 if(quoteAmount===null||quoteAmount===0)reasons.push('The original lead has no positive recorded quoted amount.');
 const comparable=reasons.length===0;
 // This arithmetic is a *scenario*, never earned revenue, cash or verified margin.
 const quoteLessFieldCost=comparable&&quoteAmount!==null&&reviewed?.totalDirectCost!==null&&reviewed?.totalDirectCost!==undefined
  ?cents(quoteAmount-reviewed.totalDirectCost):null;
 const quoteLessFieldCostRatio=quoteLessFieldCost!==null&&quoteAmount!==null&&quoteAmount>0
  ?cents(quoteLessFieldCost/quoteAmount*100):null;
 // Planned scenario from browser lead draft is not a signed booking-specific work order.
 const plannedCostMinusFieldCost=estimateSourceCurrent&&fieldSourceCurrent&&planned?.cost!==null&&planned?.cost!==undefined&&
 reviewed?.totalDirectCost!==null&&reviewed?.totalDirectCost!==undefined&&count===1
  ?cents(planned.cost-reviewed.totalDirectCost):null;
 const warnings:string[]=[];
 if(!estimate)warnings.push('No browser-local estimate draft loaded for the original lead. It may exist only on another device.');
 else if(!estimateSourceCurrent)warnings.push('This browser estimate does not match the latest original lead quote/source stamp. Its planned numbers may be stale.');
 if(!field)warnings.push('No valid booking-specific local field report available.');
 else if(!fieldSourceCurrent)warnings.push('The field report is not current with this exact booking; do not use its figures for this job.');
 if(count>1)warnings.push('Lead-level quote/revenue/cost may represent multiple visits; never multiply or assign them to a booking.');
 if(lead.job_revenue!==null||lead.job_cost!==null)
  warnings.push('Historical lead-level job_revenue and job_cost remain separate from this visit and are not proof of bank settlement or booking-specific actuals.');
 if(planned&&planned.cost===null)warnings.push('The planned estimate has incomplete cost assumptions; planned direct cost is unknown.');
 if(reviewed&&reviewed.totalDirectCost===null)warnings.push('Local actual work expenses are operator-entered and cost coverage is incomplete.');
 if(reviewed&&reviewed.criticalIssues>0)warnings.push('Unresolved stop-work issue(s) in the field log; no work completion clearance can be inferred.');
 warnings.push('Customer approval, final invoice, payment, payroll and verified booked-job revenue are not established by this review.');
 return {bookingId:booking.id,leadId:lead.id,sourceBookingCount:count,sourceBookingCurrent,bookingCoverageComplete,
  quoteAmount,quoteAccepted:'unverified',localEstimateAvailable,estimateSourceCurrent,
  planned,field:reviewed,fieldSourceCurrent,fieldHoursReviewed,
  quoteLessFieldCost,quoteLessFieldCostRatio,plannedCostMinusFieldCost,
  comparable,comparisonReasons:reasons,warnings};
}
export function jobEconomicsInternalBrief(report:JobEconomicsReview,lead:ExtLead,booking:ExtBooking):string{
 const money=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 return [
  'OJ EXTERIOR CARE — INTERNAL JOB ECONOMICS REVIEW',
  'NOT A CUSTOMER PROPOSAL, ACCEPTANCE RECEIPT, VERIFIED INVOICE, BANK PAYMENT OR ACCOUNTING STATEMENT',
  'Booking ID: '+report.bookingId,'Original lead ID: '+report.leadId,
  'Customer: '+(lead.name??'Unknown'),'Service address: '+(lead.address??'Unknown'),
  'Booking date: '+booking.date+' / source booking status '+(booking.status??'unknown'),
  'Complete booking source coverage: '+(report.bookingCoverageComplete?'yes':'not proven'),
  'Lead-level quote: '+money(report.quoteAmount)+' (NOT accepted or booking-revenue evidence)',
  'Local estimate source current: '+(report.estimateSourceCurrent?'yes':'no or missing'),
  'Local planned direct cost: '+money(report.planned?.cost??null),
  'Field record current for booking: '+(report.fieldSourceCurrent?'yes':'no'),
  'Operator-entered reviewed hours: '+(report.fieldHoursReviewed===null?'Unknown':report.fieldHoursReviewed+' h'),
  'Operator-entered direct cost: '+money(report.field?.totalDirectCost??null),
  'Estimated quoted-price headroom (SCENARIO ONLY): '+money(report.quoteLessFieldCost),
  'Scenario ratio, NOT profit margin: '+(report.quoteLessFieldCostRatio===null?'Unknown':report.quoteLessFieldCostRatio+'%'),
  'Local planned direct cost less operator-estimated direct cost: '+money(report.plannedCostMinusFieldCost),
  'Completeness / eligibility: '+(report.comparable?'source-unique and estimated direct costs complete':'not comparable'),
  '',
  ...report.comparisonReasons.map(x=>'LIMITATION: '+x),
  ...report.warnings.map(x=>'CAUTION: '+x),
  '',
  'Verify quote acceptance, invoice/bank collection, actual costs, and work completion in their separate source systems.',
 ].join('\n');
}
