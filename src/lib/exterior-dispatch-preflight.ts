import type {ExtBooking,ExtLead,ExteriorData} from './exterior';
import {addBookingDays} from './exterior-booking-workflow';
import {blockLabel,isRealPhone,parseBlock} from './exterior-ops';

/**
 * R36: Source-qualified DISPATCH REVIEW, not a confirmed crew assignment,
 * signed quote, earned revenue, payment, or site-safety clearance.
 * Never multiply the legacy lead's one price across multiple booked visits.
 */
export type DispatchFinding={
 code:string;level:'blocker'|'attention';label:string;
 destination:'bookings'|'customer'|'estimate'|'field';
};
export type DispatchPreflightRow={
 id:string;leadId:string|null;date:string;time:string;status:string;
 customer:string;service:string;address:string|null;phone:string|null;
 quotedVisitAmount:number|null;findings:DispatchFinding[];
 isConfirmed:boolean;hasTimeOverlap:boolean;
};
export type DispatchPriceReview={
 total:number|null;eligible:number;confirmed:number;notAttributable:number;
 sourceComplete:boolean;
};
export type DispatchPreflightReport={
 sourceComplete:boolean;bookingCoverageComplete:boolean;leadCoverageComplete:boolean;
 through:string;today:string;rows:DispatchPreflightRow[];
 counts:{upcoming:number;confirmed:number;pending:number;blocked:number;attention:number;overlaps:number};
 price:DispatchPriceReview;
};
const complete=(value:{loaded:number;total:number|null}|undefined)=>!!value&&
 value.total!==null&&Number.isInteger(value.total)&&value.total>=0&&value.loaded>=value.total;
const day=(s:string)=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&
 Number.isFinite(Date.parse(s+'T12:00:00Z'))&&
 new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const price=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<1e7;
const active=(b:ExtBooking)=>b.status!=='denied'&&b.status!=='cancelled';
const eligible=(b:ExtBooking)=>b.status==='confirmed';
const leadFor=(b:ExtBooking,leads:ReadonlyMap<string,ExtLead>)=>leads.get(b.lead_id??'');
const start=(b:ExtBooking)=>parseBlock(b.time_block)?.start??Number.MAX_SAFE_INTEGER;

export function quoteAttributionForBooking(
 booking:ExtBooking,lead:ExtLead|undefined,allBookings:readonly ExtBooking[],
 data:ExteriorData,
):number|null{
 if(!eligible(booking)||!lead||booking.lead_id!==lead.id||
    !complete(data.coverage?.bookings)||!complete(data.coverage?.leads))return null;
 const same=allBookings.filter(b=>b.lead_id===lead.id&&active(b));
 if(same.length!==1||same[0].id!==booking.id||!price(lead.quote_amount))return null;
 return lead.quote_amount;
}

/**
 * Number is exposed only if EVERY source-confirmed booking has a positive
 * uniquely attributable original lead quote, and both source windows are
 * proven complete. Pending/denied/cancelled are never included as "booked."
 */
export function qualifiedDispatchQuotes(
 data:ExteriorData,selected:readonly ExtBooking[],
):DispatchPriceReview{
 const sourceComplete=complete(data.coverage?.bookings)&&complete(data.coverage?.leads);
 const leads=new Map(data.leads.map(l=>[l.id,l]));
 const selectedConfirmed=selected.filter(eligible);
 let subtotal=0,eligibleCount=0;
 for(const b of selectedConfirmed){
  const value=quoteAttributionForBooking(b,leadFor(b,leads),data.bookings,data);
  if(value!==null){subtotal+=value;eligibleCount++;}
 }
 const confirmed=selectedConfirmed.length;
 const notAttributable=confirmed-eligibleCount;
 return {total:confirmed>0&&notAttributable===0&&sourceComplete?
  Math.round(subtotal*100)/100:null,
  eligible:eligibleCount,confirmed,notAttributable,sourceComplete};
}
export function buildDispatchPreflight(
 data:ExteriorData,today:string,horizonDays=14,
):DispatchPreflightReport{
 if(!day(today)||!Number.isInteger(horizonDays)||horizonDays<0||horizonDays>60)
  throw Error('Dispatch preflight requires a valid source business date and bounded horizon.');
 const through=addBookingDays(today,horizonDays);
 const bookingCoverageComplete=complete(data.coverage?.bookings);
 const leadCoverageComplete=complete(data.coverage?.leads);
 const sourceComplete=bookingCoverageComplete&&leadCoverageComplete;
 const leads=new Map(data.leads.map(l=>[l.id,l]));
 const rows=data.bookings.filter(b=>active(b)&&day(b.date)&&b.date>=today&&b.date<=through)
 .sort((a,b)=>a.date.localeCompare(b.date)||start(a)-start(b)||a.id.localeCompare(b.id));
 const overview:DispatchPreflightRow[]=rows.map(b=>{
  const lead=leadFor(b,leads);
  const findings:DispatchFinding[]=[];
  const add=(code:string,level:'blocker'|'attention',label:string,destination:DispatchFinding['destination'])=>
   findings.push({code,level,label,destination});
  if(b.status==='pending_approval')add('pending-approval','blocker','Booking still awaits explicit source approval.','bookings');
  else if(b.status!=='confirmed')add('unconfirmed-status','blocker','Booking status is not confirmed in the source.','bookings');
  if(!lead)add('lead-absent','blocker','Linked customer not present in the loaded source.','bookings');
  else {
   if(!lead.name?.trim())add('customer-name','attention','Customer name not recorded.','customer');
   if(!lead.address?.trim())add('site-address','blocker','Service address missing.','customer');
   if(!lead.service_requested?.trim())add('scope','attention','Requested service/scope not recorded.','customer');
   if(!isRealPhone(lead.phone))add('contact','attention','Usable customer contact number not recorded.','customer');
  }
  const parsed=parseBlock(b.time_block);
  if(!parsed)add('time','blocker','Scheduled start/end time is missing or cannot be interpreted.','bookings');
  // Flag resource planning risk only; parallel jobs may be legitimate with multiple crews.
  const hasTimeOverlap=!!parsed&&data.bookings.some(other=>{
   if(other.id===b.id||!active(other)||!['confirmed','pending_approval'].includes(other.status??'')||
      other.date!==b.date)return false;
   const otherTime=parseBlock(other.time_block);
   return !!otherTime&&parsed.start<otherTime.end&&otherTime.start<parsed.end;
  });
  if(hasTimeOverlap)add('overlap','attention','Time overlaps another source booking; verify crew/rig capacity.','bookings');
  const visitPrice=quoteAttributionForBooking(b,lead,data.bookings,data);
  if(b.status==='confirmed'&&visitPrice===null)
   add('quote-identity','attention',!sourceComplete?
    'Quoted visit amount withheld: complete customer and booking coverage not proven.':
    !lead||!price(lead.quote_amount)?
    'Original lead has no positive recorded quote for this visit.':
    'Lead quote cannot safely be attributed to this particular visit.','estimate');
  return {
   id:b.id,leadId:lead?.id??null,date:b.date,
   time:parsed?blockLabel(b.time_block):'Time not verified',
   status:b.status??'Unknown',customer:lead?.name?.trim()||'Customer source unavailable',
   service:lead?.service_requested?.trim()||'Service not recorded',
   address:lead?.address?.trim()||null,phone:lead&&isRealPhone(lead.phone)?lead.phone:null,
   quotedVisitAmount:visitPrice,findings,
   isConfirmed:b.status==='confirmed',hasTimeOverlap,
  };
 });
 return {
  today,through,rows:overview,sourceComplete,bookingCoverageComplete,leadCoverageComplete,
  counts:{
   upcoming:overview.length,
   confirmed:overview.filter(x=>x.isConfirmed).length,
   pending:overview.filter(x=>x.status==='pending_approval').length,
   blocked:overview.filter(x=>x.findings.some(f=>f.level==='blocker')).length,
   attention:overview.filter(x=>x.findings.length>0).length,
   overlaps:overview.filter(x=>x.hasTimeOverlap).length,
  },
  price:qualifiedDispatchQuotes(data,rows),
 };
}
