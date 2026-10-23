import {jobDate, jobDateBasis, type ExteriorData, type ExtBooking, type ExtLead, type ExtQuote} from './exterior';
import {businessDay} from './reporting';

export type CustomerEvent={
 id:string; day:string; title:string; detail:string;
 kind:'intake'|'update'|'booking'|'completion'; basis:'source-date'|'estimated-date';
};
export type CustomerCandidate={
 id:string; kind:'lead'|'website-request'; label:string; reason:string;
 lead?:ExtLead; quote?:ExtQuote;
};
/**
 * Read-only exact-ID dossier of one legacy Exterior lead.
 * WARNING: this is a source record, NOT a deduplicated person/property.
 * Neither equal phones nor names/addresses automatically merge customer identities.
 */
export type CustomerDossier={
 lead:ExtLead;bookings:ExtBooking[];events:CustomerEvent[];candidates:CustomerCandidate[];
 money:{quote:number|null;recordedJobRevenue:number|null;recordedJobCost:number|null;knownContribution:number|null};
 coverage:{complete:boolean;notes:string[]};sourceId:string;
};
const known=(n:number|null):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const normalizePhone=(phone:string|null):string|null=>{
 if(!phone)return null;
 const digits=phone.replace(/\D/g,'');
 if(digits.length===10)return digits;
 if(digits.length===11&&digits.startsWith('1'))return digits.slice(1);
 return null;
};
const latest=(s:string|null):string=>s?businessDay(s)??'': '';
const cleanAddress=(s:string|null):string|null=>{
 const v=s?.trim().toLowerCase().replace(/\s+/g,' ').replace(/[.,]/g,'')??'';
 return v.length>=12?v:null;
};
/** No quote request is represented as an approved estimate, job or paid revenue. */
export function buildCustomerDossier(data:ExteriorData,leadId:string):CustomerDossier|null{
 if(!leadId||leadId.length>128)return null;
 const lead=data.leads.find(l=>l.id===leadId);
 if(!lead)return null;
 const bookings=data.bookings.filter(b=>b.lead_id===lead.id)
  .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 const events:CustomerEvent[]=[];
 const created=latest(lead.created_at);
 if(created)events.push({id:'intake:'+lead.id,day:created,title:'Inquiry recorded',
  detail:'Lead source and initial record date. This is not proof of a customer reply.',kind:'intake',basis:'source-date'});
 const updated=latest(lead.updated_at);
 if(updated&&updated!==created)events.push({id:'update:'+lead.id,day:updated,title:'Source record updated',
  detail:'Status and individual changes cannot be reconstructed from this date alone.',kind:'update',basis:'source-date'});
 for(const booking of bookings){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(booking.date)||!Number.isFinite(new Date(booking.date+'T12:00:00Z').getTime()))continue;
  events.push({id:'booking:'+booking.id,day:booking.date,title:'Booking '+(booking.status??'status not recorded').replaceAll('_',' '),
   detail:'Scheduled service date and current source booking status. Not proof the work occurred on this date.',kind:'booking',basis:'source-date'});
 }
 if(lead.status==='completed'){
  const completion=latest(jobDate(lead));
  if(completion)events.push({id:'completion:'+lead.id,day:completion,
   title:lead.completed_at?'Completion timestamp recorded':'Completed status; date estimated',
   detail:lead.completed_at?'Source completion timestamp exists; independent closeout evidence not supplied.':'The historical record uses updated/created date as fallback, not a confirmed job completion timestamp.',
   kind:'completion',basis:jobDateBasis(lead)==='completion'?'source-date':'estimated-date'});
 }
 events.sort((a,b)=>b.day.localeCompare(a.day)||a.id.localeCompare(b.id));
 const phone=normalizePhone(lead.phone);
 const address=cleanAddress(lead.address);
 const candidates:CustomerCandidate[]=[];
 for(const other of data.leads){
  if(other.id===lead.id)continue;
  const samePhone=phone!==null&&normalizePhone(other.phone)===phone;
  const sameAddress=address!==null&&cleanAddress(other.address)===address;
  if(samePhone||sameAddress)candidates.push({id:'lead:'+other.id,kind:'lead',label:other.name??'Unnamed customer',
    reason:samePhone&&sameAddress?'Same recorded phone and address':samePhone?'Same recorded phone':'Same recorded address',lead:other});
 }
 for(const quote of data.extras?.quotes??[]){
  const samePhone=phone!==null&&normalizePhone(quote.phone)===phone;
  const sameAddress=address!==null&&cleanAddress(quote.address)===address;
  if(samePhone||sameAddress)candidates.push({id:'request:'+quote.id,kind:'website-request',label:quote.name??'Unnamed website inquiry',
    reason:samePhone&&sameAddress?'Same recorded phone and address':samePhone?'Same recorded phone':'Same recorded address',quote});
 }
 const coverageNotes:string[]=[];
 if(data.coverage?.leads?.total===null||!data.coverage?.leads)coverageNotes.push('Full lead-history coverage is not confirmed.');
 else if(data.coverage.leads.loaded<data.coverage.leads.total)coverageNotes.push('Some lead records are outside the loaded source window; possible duplicates may be missing.');
 if(data.coverage?.bookings?.total===null||!data.coverage?.bookings)coverageNotes.push('Full booking-history coverage is not confirmed.');
 else if(data.coverage.bookings.loaded<data.coverage.bookings.total)coverageNotes.push('Booking history is partial; this dossier may be missing appointments.');
 if(data.extras===null)coverageNotes.push('Website quote requests are not available from this source.');
 coverageNotes.push('Legacy finance amounts are attached to this lead, not individual booking or verified bank settlements.');
 const money={quote:known(lead.quote_amount)?lead.quote_amount:null,
  recordedJobRevenue:known(lead.job_revenue)?lead.job_revenue:null,
  recordedJobCost:known(lead.job_cost)?lead.job_cost:null,
  knownContribution:known(lead.job_revenue)&&known(lead.job_cost)?lead.job_revenue-lead.job_cost:null};
 return {lead,bookings,events,candidates:candidates.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id)),
  money,coverage:{complete:coverageNotes.length===1&&data.extras!==null,notes:coverageNotes},sourceId:lead.id};
}
