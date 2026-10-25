import type { Card } from './board';
import type { Dashboard } from './dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { buildIntelligence, type IntelligenceSignal, type IntelligenceSnapshot } from './corporate-intelligence';
import { chicagoDay } from './founder-weekly-review';
import { contentPersistenceEnabled, ventureIds, type VentureId } from './ventures';

export type AtlasMode='today'|'operations'|'growth'|'money'|'strategy';
export const atlasModes:readonly AtlasMode[]=['today','operations','growth','money','strategy'];
export type AtlasEvent={key:string;date:string;title:string;detail:string;business:VentureId|null;href:string;source:string};
export type AtlasVenture={id:VentureId;active:boolean;openTasks:number;leads:number|null;sourceOpen:number|null;sourceState:'available'|'partial'|'unavailable'|'not-connected'|'unknown';upcomingBookings:number|null;primarySignal:IntelligenceSignal|null};
export type AtlasFounder={name:string;open:number;inReview:number;overdue:number};
export type AtlasSnapshot={
  intelligence:IntelligenceSnapshot;
  ventures:AtlasVenture[];
  schedule:AtlasEvent[];
  founders:AtlasFounder[];
  finance:{recordedRevenue:number;recordedCosts:number;revenueEntries:number;costEntries:number;available:boolean};
  sourceState:'partial'|'reported'|'unknown';
  sourceIssues:number|null;
  currentEvents:number|null;
  available:boolean;
  limited:boolean;
  notes:string[];
};
export type AtlasInput={cards:Card[];dashboard:Dashboard|null;jobs:JobItem[];today:string;limited?:boolean};
const addDay=(day:string,offset:number)=>{
  const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);
  return d.toISOString().slice(0,10);
};
/**
 * Source-bound ATLAS command summary. No external lookups, data writes, invented
 * customer relationships, completion timestamps, confirmed cash or inferred
 * physical staff location. Zero is a count of LOADED rows, not a global all-clear.
 */
export function buildAtlasSnapshot({cards,dashboard,jobs,today,limited=false}:AtlasInput):AtlasSnapshot{
  const intelligence=buildIntelligence({cards,dashboard,jobs,today});
  const through=addDay(today,6);
  const activeBookings=jobs.filter(j=>j.status!=='cancelled'&&j.status!=='denied'&&j.date>=today&&j.date<=through);
  const schedule:AtlasEvent[]=[
    ...activeBookings.map(job=>({key:'booking:'+job.id,date:job.date,
      title:job.name||'Unnamed booking',detail:job.service||'Service not recorded',
      business:'exterior' as const,href:'/b/exterior/calendar',source:'Loaded Exterior booking'})),
    ...(dashboard?.events??[]).flatMap(event=>{
      const date=chicagoDay(event.starts_at);
      return date&&date>=today&&date<=through?[{key:'event:'+event.id,date,
        title:event.title,detail:event.location||'Calendar event',business:event.venture,
        href:'/calendar?event='+encodeURIComponent(event.id),
        source:event.source?'Imported calendar':'Workspace calendar'}]:[];
    }),
  ].sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key)).slice(0,12);

  const currentCards=cards.filter(c=>c.stage!=='Done');
  const founders=new Map<string,AtlasFounder>();
  for(const c of currentCards){
    const name=c.assignee.trim()||'Unassigned';
    const entry=founders.get(name)??{name,open:0,inReview:0,overdue:0};
    entry.open++;
    if(c.stage==='Review')entry.inReview++;
    if(c.due_date&&c.due_date<today)entry.overdue++;
    founders.set(name,entry);
  }
  const owners=[...founders.values()].sort((a,b)=>b.open-a.open||a.name.localeCompare(b.name)).slice(0,8);
  const financeEntries=(dashboard?.finance??[]).filter(f=>chicagoDay(f.occurred_on)?.slice(0,7)===today.slice(0,7)&&Number.isFinite(f.amount));
  const revenue=financeEntries.filter(f=>f.kind==='revenue');
  const costs=financeEntries.filter(f=>f.kind==='cost');
  const sourceIssues=dashboard?.reporting?.sources
    ?dashboard.reporting.sources.filter(s=>s.state!=='available').length:null;
  const ventures=ventureIds.map(id=>{
    const active=id!=='content'||contentPersistenceEnabled;
    const sourceId=id==='exterior'?'exterior':id==='solutions'?'ghl':null;
    const source=sourceId?dashboard?.reporting?.sources.find(s=>s.id===sourceId):null;
    const sourceState:AtlasVenture['sourceState']=source?.state??'unknown';
    // Original Exterior leads are not the separate Workspace CRM. Missing
    // source coverage must be unknown rather than a falsely confident zero.
    const sourceOpen=sourceId&&dashboard&&Object.hasOwn(dashboard.openElsewhere??{},id)
      ? dashboard.openElsewhere?.[id]??null:null;
    return {id,active,
      openTasks:currentCards.filter(c=>c.business===id).length,
      leads:active&&dashboard?dashboard.leads.filter(l=>l.venture===id&&l.stage!=='Won'&&l.stage!=='Lost').length:null,
      sourceOpen,sourceState,
      upcomingBookings:id==='exterior'?activeBookings.length: null,
      primarySignal:intelligence.signals.find(s=>s.business===id)??null,
    };
  });
  const notes=[
    'Today and near-term views are based on loaded records, not guaranteed complete schedules or provider activity.',
    'Task ownership shows the assignee text on unfinished tasks; it is not a live staff location or time-tracking signal.',
    'Finance entries are recorded revenue/cost tags, which may include estimates or imported order totals. They are not verified collected cash, bank balances or company profit.',
    'Provider counts and source freshness are unknown unless actually supplied by the workspace. Unavailable does not mean zero.',
  ];
  if(!dashboard)notes.unshift('Workspace CRM, finance and calendar records were unavailable in this authorized snapshot.');
  if(limited)notes.unshift('The workspace board snapshot was capped. All counts can understate company records.');
  return {intelligence,ventures,schedule,founders:owners,
    finance:{recordedRevenue:revenue.reduce((s,f)=>s+f.amount,0),
      recordedCosts:costs.reduce((s,f)=>s+f.amount,0),revenueEntries:revenue.length,
      costEntries:costs.length,available:Boolean(dashboard)},
    sourceState:!dashboard||!dashboard.reporting?.sources?'unknown':sourceIssues?'partial':'reported',
    sourceIssues,currentEvents:dashboard?.events.length??null,
    available:true,limited,notes};
}
export function atlasSignalsForMode(snapshot:AtlasSnapshot,mode:AtlasMode):IntelligenceSignal[]{
  const all=snapshot.intelligence.signals;
  if(mode==='operations')return all.filter(x=>x.category==='Execution'||x.category==='Schedule');
  if(mode==='growth')return all.filter(x=>x.category==='Pipeline');
  if(mode==='money')return all.filter(x=>x.category==='Data integrity');
  if(mode==='strategy')return all.filter(x=>x.severity==='urgent'||x.severity==='attention');
  return all;
}
