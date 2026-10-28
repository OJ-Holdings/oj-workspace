import type { ExtLead } from './exterior';
import { openStatuses } from './exterior';

/**
 * ATLAS / Lead Workbench. These are explicit recorded-state queues, not
 * inferred customer replies, response deadlines, accepted quotes or receipts.
 */
export const leadWorkFocuses=[
  'all','new','follow-up','quoted','booked','needs-accounting',
] as const;
export type LeadWorkFocus=typeof leadWorkFocuses[number];

export const leadWorkLabels:Record<LeadWorkFocus,string>={
  all:'All customers',
  new:'New inquiries',
  'follow-up':'Follow-up',
  quoted:'Quoted opportunities',
  booked:'Booked',
  'needs-accounting':'Missing job figures',
};
export const leadWorkDescriptions:Record<LeadWorkFocus,string>={
  all:'Everyone in your lead list.',
  new:'Not contacted yet.',
  'follow-up':'Contacted or being followed up.',
  quoted:'Quoted but not booked yet.',
  booked:'Booked on the calendar.',
  'needs-accounting':'Done jobs missing revenue or costs.',
};
export function matchesLeadWorkFocus(lead:ExtLead,focus:LeadWorkFocus):boolean{
  const s=lead.status??'';
  if(focus==='all')return true;
  if(focus==='new')return s==='new';
  if(focus==='follow-up')return s==='contacted'||s==='following_up';
  if(focus==='quoted')return openStatuses.includes(s) && s!=='booked' && lead.quote_amount!==null;
  if(focus==='booked')return s==='booked';
  if(focus==='needs-accounting')return s==='completed'&&(lead.job_revenue===null||lead.job_cost===null);
  return false;
}
export function countLeadWorkFocuses(leads:readonly ExtLead[]):Record<LeadWorkFocus,number>{
  return Object.fromEntries(leadWorkFocuses.map(focus=>[
    focus,leads.reduce((sum,lead)=>sum+Number(matchesLeadWorkFocus(lead,focus)),0),
  ])) as Record<LeadWorkFocus,number>;
}
export function sortLeadsForWork<T extends ExtLead>(leads:readonly T[]):T[]{
  // Sort solely by the actual source creation timestamp; an old lead is NOT
  // assumed overdue, and a missing source date is not replaced with "today".
  return [...leads].sort((a,b)=>
    b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
