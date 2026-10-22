import type { Card } from './board';
import type { Lead } from './dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';

type HandoffDraft=Pick<Card,'business'|'title'|'description'|'due_date'|'priority'>;
const clean=(value:string,max=160)=>value.replace(/[\r\n\t]/g,' ').trim().slice(0,max);
const safeBase=(base:string)=>base==='/preview'?'/preview':'/workspace';

/**
 * Prefill only: no card is saved until the user explicitly submits the normal
 * task editor. Never copy contact details, customer phone/email or financial
 * assumptions into the board.
 */
export function followUpFromCrmLead(lead:Lead,base:string):HandoffDraft{
  const name=clean(lead.name||'Unnamed lead',110);
  return {
    business:lead.venture,priority:'normal',due_date:'',
    title:'Follow up: '+name,
    description:'CRM follow-up draft. Confirm what was actually discussed before updating the lead or recording outreach.\n'+
      'Workspace CRM source: '+safeBase(base)+'/crm?lead='+encodeURIComponent(lead.id),
  };
}

/** Source-identifiable booking handoff; a booking is NOT a collected payment. */
export function followUpFromExteriorBooking(job:JobItem,base:string):HandoffDraft{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(job.date)||Number.isNaN(Date.parse(job.date+'T00:00:00Z'))||
    new Date(job.date+'T00:00:00Z').toISOString().slice(0,10)!==job.date){
    throw new Error('A valid source booking date is required.');
  }
  if(job.status==='cancelled'||job.status==='denied')throw new Error('Cannot create an active-work draft for an inactive booking.');
  const who=clean(job.name||'Unnamed customer',100);
  const service=clean(job.service||'Service not specified',140);
  return {
    business:'exterior',priority:'normal',due_date:job.date,
    title:'Prepare booking: '+who,
    description:[
      'Service preparation draft. Verify crew, equipment, access and customer scope before dispatch.',
      'Recorded service: '+service,
      'Booking record ID: '+job.id,
      'Source booking: '+safeBase(base)+'/b/exterior/calendar',
      ...(job.lead_id?['Exterior source lead: '+safeBase(base)+'/b/exterior/leads?lead='+encodeURIComponent(job.lead_id)]:[]),
      'Booking status at task creation: '+clean(job.status||'Not recorded',80),
    ].join('\n'),
  };
}

/** Recognize only a preserved source ID, not a person or property name. */
export function exactBookingReferences(description:string):string[]{
  const re=/^Booking record ID:\s*([A-Za-z0-9._:-]{1,180})\s*$/gm;
  return [...new Set([...description.matchAll(re)].map(match=>match[1]))];
}
