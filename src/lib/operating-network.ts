import type { Card } from './board';
import type { Dashboard } from './dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { chicagoDay } from './founder-weekly-review';
import { ventureIds, type VentureId } from './ventures';

export const operatingKinds = ['task','lead','booking','event','document','finance','message'] as const;
export type OperatingKind = typeof operatingKinds[number];
export type OperatingRecord = {
  key:string; kind:OperatingKind; business:VentureId|null;
  title:string; detail:string; href:string; source:string;
  day:string|null; priority:number; status:string;
};
export type OperatingRelation = {
  key:string; fromKey:string; toKey:string|null; label:string;
  href:string; provenance:string;
};
export type BusinessCoverage = {
  business:VentureId|null;
  tasks:number; leads:number; bookings:number; events:number;
  documents:number; finance:number; messages:number;
};
export type OperatingNetwork = {
  records:OperatingRecord[];
  relations:OperatingRelation[];
  coverage:BusinessCoverage[];
  loaded:number;
  shown:number;
  capped:boolean;
  dashboardAvailable:boolean;
  warnings:string[];
  counts:{ overdue:number; review:number; unassigned:number; upcomingBookings:number; dueNextSeven:number };
};
export type OperatingNetworkInput={
  cards:Card[]; dashboard:Dashboard|null; jobs:JobItem[];
  today:string; limited?:boolean;
};
const validDay=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const plusDays=(day:string,n:number)=>{
  const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
};
const enc=encodeURIComponent;
const row=(key:string,kind:OperatingKind,business:VentureId|null,title:string,
  detail:string,href:string,source:string,day:string|null,status:string,priority:number):OperatingRecord=>
  ({key,kind,business,title,detail,href,source,day,status,priority});
const empty=(business:VentureId|null):BusinessCoverage=>
  ({business,tasks:0,leads:0,bookings:0,events:0,documents:0,finance:0,messages:0});
/** Only machine-identifiable workspace CRM links, never name/phone similarity. */
export function explicitCrmLeadIds(description:string):string[]{
  const ids:string[]=[];
  const re=/\/crm\?lead=([A-Za-z0-9._%\-]+)/g;
  for(const match of description.matchAll(re)){
    try{
      const id=decodeURIComponent(match[1]);
      if(id&&id.length<=256&&!ids.includes(id))ids.push(id);
    }catch{/* Malformed percent-encoding is never a relation. */}
  }
  return ids;
}

/** An authorized, read-only index: not a new source of truth or persistent join. */
export function buildOperatingNetwork(input:OperatingNetworkInput):OperatingNetwork {
  const {cards,dashboard,jobs,today,limited=false}=input;
  if(!validDay(today))throw new Error('A valid Chicago reporting day is required.');
  const weekEnd=plusDays(today,6);
  const records:OperatingRecord[]=[];
  const relations:OperatingRelation[]=[];
  const coverage=new Map<VentureId|null,BusinessCoverage>(
    [...ventureIds,null].map(id=>[id,empty(id)]));
  const add=(record:OperatingRecord)=>{
    records.push(record);
    const stat=coverage.get(record.business);
    if(stat)stat[record.kind==='task'?'tasks':record.kind==='lead'?'leads':
      record.kind==='booking'?'bookings':record.kind==='event'?'events':
      record.kind==='document'?'documents':record.kind==='finance'?'finance':'messages']++;
  };
  const leadsById=new Map((dashboard?.leads??[]).map(l=>[l.id,l]));
  let overdue=0,review=0,unassigned=0,upcomingBookings=0,dueNextSeven=0;
  for(const task of cards){
    if(task.stage==='Done')continue;
    const due=validDay(task.due_date)?task.due_date:null;
    const isOverdue=Boolean(due&&due<today);
    if(isOverdue)overdue++;
    if(task.stage==='Review')review++;
    if(!task.assignee.trim())unassigned++;
    if(due&&due>=today&&due<=weekEnd)dueNextSeven++;
    const priority=isOverdue?0:due===today?1:task.stage==='Review'?2:
      !task.assignee.trim()?3:task.priority==='high'?4:due&&due<=weekEnd?5:10;
    add(row('task:'+task.id,'task',task.business,task.title,
      (task.assignee.trim()||'Unassigned')+' · '+task.stage+
      (due?' · Due '+due:''),
      '/tasks?task='+enc(task.id),'Shared task board',due,task.stage,priority));
    for(const id of explicitCrmLeadIds(task.description)){
      const lead=leadsById.get(id);
      if(!lead||lead.venture!==task.business)continue;
      relations.push({
        key:'task:'+task.id+'/lead:'+id,fromKey:'task:'+task.id,toKey:'lead:'+id,
        label:'Explicit CRM lead reference',href:'/crm?lead='+enc(id),
        provenance:'Exact CRM record ID in task description; same business and loaded record',
      });
    }
  }
  for(const lead of dashboard?.leads??[]){
    const day=chicagoDay(lead.created_at);
    add(row('lead:'+lead.id,'lead',lead.venture,lead.name||'Unnamed CRM lead',
      lead.stage+(lead.source?' · '+lead.source:''),
      '/crm?lead='+enc(lead.id),'Workspace CRM',day,lead.stage,
      lead.stage==='Proposal'?6:lead.stage==='New'?9:15));
  }
  for(const booking of jobs){
    if(booking.status==='cancelled'||booking.status==='denied')continue;
    const day=validDay(booking.date)?booking.date:null;
    const upcoming=Boolean(day&&day>=today&&day<=weekEnd);
    if(upcoming)upcomingBookings++;
    add(row('booking:'+booking.id,'booking','exterior',
      booking.name||'Unnamed Exterior booking',
      (booking.service||'Service unrecorded')+' · '+(booking.status||'Status unrecorded')+
      (booking.time_block?' · '+booking.time_block:''),
      '/b/exterior/calendar','Loaded Exterior booking',day,booking.status||'Unknown',
      upcoming?day===today?1:5:12));
    if(booking.lead_id){
      relations.push({
        key:'booking:'+booking.id+'/exterior-lead:'+booking.lead_id,
        fromKey:'booking:'+booking.id,toKey:null,
        label:'Exterior source lead',href:'/b/exterior/leads?lead='+enc(booking.lead_id),
        provenance:'Booking source lead_id; separate from workspace CRM identifiers',
      });
    }
  }
  for(const event of dashboard?.events??[]){
    const day=chicagoDay(event.starts_at);
    const upcoming=Boolean(day&&day>=today&&day<=weekEnd);
    add(row('event:'+event.id,'event',event.venture,event.title,
      (event.location||'Location not recorded')+(event.source?' · External calendar':''),
      '/calendar?event='+enc(event.id),event.source?'Imported calendar':'Workspace calendar',
      day,event.source?'External read-only':'Scheduled',upcoming?6:14));
  }
  for(const doc of dashboard?.documents??[]){
    add(row('document:'+doc.id,'document',doc.venture,doc.name,doc.tag,
      '/files?document='+enc(doc.id),'Company documents',
      chicagoDay(doc.created_at),doc.tag,17));
  }
  for(const entry of dashboard?.finance??[]){
    // No amount appears in the operating index: entry labels do not prove payment.
    add(row('finance:'+entry.id,'finance',entry.venture,
      entry.category||'Recorded finance entry',entry.kind+'-tagged entry · Not verified cash',
      '/finance','Workspace financial entry',
      chicagoDay(entry.occurred_on),entry.kind,18));
  }
  for(const msg of dashboard?.messages??[]){
    add(row('message:'+msg.id,'message',msg.venture,
      msg.body.slice(0,100)||'Team note','By '+msg.author,
      '/messages?message='+enc(msg.id),'Team messages',
      chicagoDay(msg.created_at),'Recorded',19));
  }
  records.sort((a,b)=>a.priority-b.priority||
    (a.day??'9999-12-31').localeCompare(b.day??'9999-12-31')||
    a.key.localeCompare(b.key));
  const maxRecords=2500;
  const shown=records.slice(0,maxRecords);
  const capped=records.length>maxRecords;
  const warnings=[
    'All results are from records this session already loaded and is authorized to view; this index does not synchronize external systems.',
    'Workspace CRM leads and Exterior source leads are different datasets. They are never joined by names or phone numbers.',
    'Only an exact loaded CRM ID in a task description and a booking source lead_id produce relationships. Unmatched entities remain unlinked.',
    'Financial entries are record labels, not verified collections, profit or bank transactions. Completed tasks do not establish payment.',
    'Bookings and provider views may be unavailable or incomplete; zero loaded items is not proof of no business activity.',
  ];
  if(!dashboard)warnings.unshift('Workspace dashboard records unavailable: CRM, finance, documents, events and messages are unknown.');
  if(limited)warnings.unshift('Your authorized workspace snapshot was capped; counts may understate actual activity.');
  if(capped)warnings.unshift('The unified results list displays only its first 2,500 prioritized records; source pages contain more.');
  return {records:shown,relations:relations.filter(r=>shown.some(x=>x.key===r.fromKey)),
    coverage:[...coverage.values()],loaded:records.length,shown:shown.length,capped,
    dashboardAvailable:Boolean(dashboard),warnings,
    counts:{overdue,review,unassigned,upcomingBookings,dueNextSeven}};
}
