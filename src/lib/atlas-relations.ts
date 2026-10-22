import type { Card } from './board';
import type { Dashboard, Lead } from './dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { explicitCrmLeadIds } from './operating-network';
import { exactBookingReferences } from './operating-handoffs';

export type RelatedTask={id:string;title:string;business:Card['business'];stage:Card['stage'];assignee:string;due:string;href:string};
export type RelatedSource={kind:'workspace-lead'|'exterior-booking';id:string;title:string;detail:string;href:string};

/** Exact same-venture CRM source ID: no names/addresses/phones for joins. */
export function linkedTasksForLead(lead:Pick<Lead,'id'|'venture'>,cards:Card[]):RelatedTask[]{
  return cards.filter(task=>task.business===lead.venture&&
    explicitCrmLeadIds(task.description).includes(lead.id))
    .map(task=>({id:task.id,title:task.title,business:task.business,stage:task.stage,
      assignee:task.assignee,due:task.due_date,href:'/tasks?task='+encodeURIComponent(task.id)}))
    .sort((a,b)=>(a.stage==='Done'?1:0)-(b.stage==='Done'?1:0)||a.title.localeCompare(b.title));
}
/** A task is related to a customer/booking only through its exact loaded source ID. */
export function linkedSourcesForTask(card:Card,dashboard:Dashboard|null,jobs:JobItem[]):RelatedSource[]{
  const sources:RelatedSource[]=[];
  const leads=new Map((dashboard?.leads??[]).map(lead=>[lead.id,lead]));
  for(const id of explicitCrmLeadIds(card.description)){
    const lead=leads.get(id);
    if(!lead||lead.venture!==card.business)continue;
    sources.push({kind:'workspace-lead',id,title:lead.name||'Unnamed CRM lead',
      detail:'Workspace CRM · '+lead.stage,href:'/crm?lead='+encodeURIComponent(lead.id)});
  }
  if(card.business==='exterior'){
    const bookings=new Map(jobs.filter(job=>job.status!=='cancelled'&&job.status!=='denied')
      .map(job=>[job.id,job]));
    for(const id of exactBookingReferences(card.description)){
      const booking=bookings.get(id);
      if(!booking)continue;
      sources.push({kind:'exterior-booking',id,title:booking.name||'Unnamed Exterior booking',
        detail:booking.date+' · '+(booking.service||'Service not recorded'),
        href:'/b/exterior/calendar'});
    }
  }
  return sources;
}
