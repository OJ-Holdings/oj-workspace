import type { Card } from './board';
import { businessDay } from './reporting';
import { jobDate, jobDateBasis, sourceLabel, type ExteriorData, type ExtLead } from './exterior';
import {qualifiedDispatchQuotes,quoteAttributionForBooking} from './exterior-dispatch-preflight';

/**
 * Read-only, source-evidenced command projection. Never equates quoted, scheduled,
 * completed, recorded, invoiced, collected or reconciled money.
 */
export type ExteriorDecision={
  id:string; title:string; detail:string; href:string;
  category:'customer'|'dispatch'|'records'|'task'; impact:'act'|'review';
};
export type ExteriorCommandSnapshot={
  today:string;
  source:{partial:boolean;notes:string[];leadCoverage:string;bookingCoverage:string};
  sales:{open:number;newRequests:number;followingUp:number;quotedOpenValue:number|null;openPriced:number;openUnpriced:number;bySource:{name:string;count:number}[]};
  dispatch:{confirmedUpcoming:number;quotedUpcomingValue:number|null;priced:number;unpriced:number;next:{id:string;date:string;time:string;leadId:string|null;customer:string;service:string;address:string|null;quote:number|null}[]};
  production:{completed:number;withRevenue:number;withCosts:number;fullyCosted:number;recordedJobRevenue:number|null;matchedContribution:number|null;estimatedCompletionDates:number};
  tasks:{open:number;overdue:number;dueToday:number;unassigned:number};
  months:{key:string;revenue:number|null;recordedJobs:number;completedJobs:number}[];
  decisions:ExteriorDecision[];
};
const validAmount=(n:number|null|undefined):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const validDay=(v:string):boolean=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T12:00:00.000Z').toISOString().slice(0,10)===v;
function previousMonths(today:string):string[]{
 const [year,month]=today.split('-').map(Number);
 return Array.from({length:6},(_,i)=>{
   const d=new Date(Date.UTC(year,month-1-(5-i),15));
   return d.toISOString().slice(0,7);
 });
}
export function buildExteriorCommand(data:ExteriorData,cards:readonly Card[],today:string):ExteriorCommandSnapshot{
 if(!validDay(today))throw new Error('Exterior Command needs a valid Chicago business date.');
 const exterior=cards.filter(c=>c.business==='exterior');
 const unfinished=exterior.filter(c=>c.stage!=='Done');
 const leadMap=new Map(data.leads.map(l=>[l.id,l]));
 const pendingStatuses=new Set(['new','contacted','following_up']);
 const openLeads=data.leads.filter(l=>pendingStatuses.has(l.status??''));
 const pricedOpen=openLeads.filter(l=>validAmount(l.quote_amount));
 const booked=data.bookings.filter(b=>b.status==='confirmed'&&validDay(b.date)&&b.date>=today).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const quotedBooked=qualifiedDispatchQuotes(data,booked);
 const completed=data.leads.filter(l=>l.status==='completed');
 const withRevenue=completed.filter(l=>validAmount(l.job_revenue));
 const withCosts=completed.filter(l=>validAmount(l.job_cost));
 const matched=completed.filter(l=>validAmount(l.job_revenue)&&validAmount(l.job_cost));
 const months=previousMonths(today).map(key=>{
   const rows=completed.filter(l=>businessDay(jobDate(l))?.slice(0,7)===key);
   const recorded=rows.filter(l=>validAmount(l.job_revenue));
   return {key,revenue:recorded.length?recorded.reduce((s,l)=>s+(l.job_revenue??0),0):null,recordedJobs:recorded.length,completedJobs:rows.length};
 });
 const sourceCounts=new Map<string,number>();
 for(const lead of data.leads){const key=sourceLabel(lead.source);sourceCounts.set(key,(sourceCounts.get(key)??0)+1);}
 const decisions:ExteriorDecision[]=[];
 const newLeads=data.leads.filter(l=>l.status==='new').sort((a,b)=>b.created_at.localeCompare(a.created_at));
 if(newLeads.length)decisions.push({id:'new-leads',title:`${newLeads.length} new customer request${newLeads.length===1?'':'s'}`,
  detail:'Recorded as new; response and follow-up state need operator review.',href:'/b/exterior/leads',category:'customer',impact:'act'});
 const followups=data.leads.filter(l=>l.status==='following_up');
 if(followups.length)decisions.push({id:'followups',title:`${followups.length} follow-up${followups.length===1?'':'s'} in progress`,
  detail:'Prioritize customers with an outstanding next action.',href:'/b/exterior/leads',category:'customer',impact:'act'});
 const due=unfinished.filter(c=>c.due_date&&c.due_date<=today).sort((a,b)=>(a.due_date??'').localeCompare(b.due_date??''));
 if(due.length)decisions.push({id:'due-tasks',title:`${due.length} assigned task${due.length===1?'':'s'} due or overdue`,
  detail:'Inspect owners, deadlines and handoffs on the shared task board.',href:'/tasks',category:'task',impact:'act'});
 const missingCost=completed.length-withCosts.length;
 if(missingCost)decisions.push({id:'missing-costs',title:`${missingCost} completed job${missingCost===1?'':'s'} without recorded costs`,
  detail:'Margin for those jobs is unknown, not zero. Complete only verified historical costs.',href:'/b/exterior/jobs',category:'records',impact:'review'});
 if(booked.length&&booked.some(b=>!leadMap.has(b.lead_id??'')))decisions.push({id:'missing-customer',title:'Some bookings have no loaded customer context',
  detail:'Review the underlying source records before dispatch or customer contact.',href:'/b/exterior/bookings',category:'dispatch',impact:'review'});
 const partialNotes:string[]=[];
 const partial=(['leads','bookings','sessions'] as const).some(k=>{
  const c=data.coverage?.[k];return Boolean(c&&c.total!==null&&c.total>c.loaded);
 });
 if(partial)partialNotes.push('Some Exterior source records are outside the loaded result window. Dashboard totals reflect accessible rows only.');
 if(data.extras===null)partialNotes.push('Quote-request and business-goal extras are not available from this source.');
 const label=(name:'leads'|'bookings')=>{
  const c=data.coverage?.[name];return c?.total===null||c?.total===undefined?'Full-history coverage not reported':`${c.loaded} of ${c.total} source records loaded`;
 };
 return {
  today,
  source:{partial,notes:partialNotes,leadCoverage:label('leads'),bookingCoverage:label('bookings')},
  sales:{open:openLeads.length,newRequests:newLeads.length,followingUp:followups.length,
    quotedOpenValue:pricedOpen.length?pricedOpen.reduce((s,l)=>s+(l.quote_amount??0),0):null,
    openPriced:pricedOpen.length,openUnpriced:openLeads.length-pricedOpen.length,
    bySource:[...sourceCounts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,6)},
  dispatch:{confirmedUpcoming:booked.length,
    quotedUpcomingValue:quotedBooked.total,
    priced:quotedBooked.eligible,unpriced:quotedBooked.notAttributable,
    next:booked.slice(0,5).map(b=>{
      const lead:ExtLead|undefined=leadMap.get(b.lead_id??'');
      return {id:b.id,date:b.date,time:b.time_block??'Time not recorded',leadId:lead?.id??null,
        customer:lead?.name??'Customer not available',service:lead?.service_requested??'Service not entered',
        address:lead?.address??null,quote:quoteAttributionForBooking(b,lead,data.bookings,data)};
    })},
  production:{completed:completed.length,withRevenue:withRevenue.length,withCosts:withCosts.length,fullyCosted:matched.length,
    recordedJobRevenue:withRevenue.length?withRevenue.reduce((s,l)=>s+(l.job_revenue??0),0):null,
    matchedContribution:matched.length?matched.reduce((s,l)=>s+(l.job_revenue??0)-(l.job_cost??0),0):null,
    estimatedCompletionDates:completed.filter(l=>jobDateBasis(l)!=='completion').length},
  tasks:{open:unfinished.length,overdue:due.filter(c=>(c.due_date??'')<today).length,dueToday:due.filter(c=>c.due_date===today).length,unassigned:unfinished.filter(c=>!c.assignee.trim()).length},
  months,decisions:decisions.slice(0,6),
 };
}
