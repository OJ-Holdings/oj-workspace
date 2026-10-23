import type {LeadInput} from '../app/workspace/exterior-actions';
import type {ExtLead,ExtQuote,ExteriorData} from './exterior';
import {normalizePhone} from './exterior-ops';

export type IntakeMatch={
  id:string;lead:ExtLead;
  on:'phone'|'address'|'phone-and-address';
};
export type IntakeReview={
  request:ExtQuote;matches:IntakeMatch[];
  readyForLeadDraft:boolean;
  draft:LeadInput;notesTruncated:boolean;
};
const phone=(input:string|null):string|null=>{
  const v=normalizePhone(input);
  return v&&/^\+1\d{10}$/.test(v)?v:null;
};
const address=(input:string|null):string|null=>{
  const s=(input??'').trim().toLowerCase().replace(/[.,#]/g,' ').replace(/\s+/g,' ');
  // Avoid matching on empty, street suffix alone, city alone or very short entries.
  return s.length>=15&&/\d/.test(s)?s:null;
};
/** Nothing here confirms two source records belong to the same person. */
export function matchingExteriorLeadCandidates(request:ExtQuote,leads:readonly ExtLead[]):IntakeMatch[]{
  const requestPhone=phone(request.phone),requestAddress=address(request.address);
  return leads.flatMap(lead=>{
    const ph=Boolean(requestPhone&&requestPhone===phone(lead.phone));
    const ad=Boolean(requestAddress&&requestAddress===address(lead.address));
    if(!ph&&!ad)return [];
    return [{id:lead.id,lead,on:ph&&ad?'phone-and-address':ph?'phone':'address'} as IntakeMatch];
  }).sort((a,b)=>{
    const rank=(x:IntakeMatch)=>x.on==='phone-and-address'?0:x.on==='phone'?1:2;
    return rank(a)-rank(b)||b.lead.created_at.localeCompare(a.lead.created_at)||a.id.localeCompare(b.id);
  });
}
/**
 * Reuses existing guarded saveLead, but clearly DOES NOT create a foreign key
 * or mark a website request as processed. Text is human-readable source context.
 * Detailed original request stays in quote_requests.
 */
export function websiteRequestLeadDraft(request:ExtQuote):{draft:LeadInput;notesTruncated:boolean}{
  const fields=[
    `Website request source ID: ${request.id}`,
    `Original received: ${request.created_at}`,
    `Customer email: ${request.email?.trim()||'not supplied'}`,
    `Business: ${request.business_name?.trim()||'not supplied'}`,
    `Property type: ${request.property_type?.trim()||'not supplied'}`,
    `Recurring interest: ${request.recurring_interest===true?'yes':request.recurring_interest===false?'no':'not supplied'}`,
    `Original request description: ${request.description?.trim()||'not supplied'}`,
    'Intake context copied from website source. No client approval, estimate, payment or source-link claim.',
  ];
  const complete=fields.join('\n');
  const notesTruncated=complete.length>4000;
  const notes=notesTruncated
   ?fields.slice(0,6).join('\n').slice(0,3000)+'\nAdditional request details remain in the original website inquiry. Confirm there before quoting.'
   :complete;
  return {
    draft:{
      name:(request.name?.trim()||request.business_name?.trim()||'').slice(0,255),
      phone:request.phone?.trim()??'',
      address:request.address?.trim().slice(0,500)??'',
      service_requested:request.service_needed?.trim().slice(0,255)??'',
      source:'website',
      quote_amount:null, // The request is a service inquiry, NOT an approved quote.
      notes,
    },
    notesTruncated,
  };
}
export function reviewExteriorWebsiteIntake(data:ExteriorData):IntakeReview[]{
  if(!data.extras)return [];
  return [...data.extras.quotes].sort((a,b)=>b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id)).map(request=>{
    const {draft,notesTruncated}=websiteRequestLeadDraft(request);
    return {request,matches:matchingExteriorLeadCandidates(request,data.leads),
      readyForLeadDraft:Boolean(draft.name&&normalizePhone(draft.phone)),draft,notesTruncated};
  });
}
