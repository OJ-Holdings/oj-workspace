import type { Card } from './board';
import type { Dashboard, FinanceEntry } from './dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { buildIntelligence, type IntelligenceSignal } from './corporate-intelligence';
import type { VentureId } from './ventures';

export type WeeklyReviewInput = {
  cards: Card[];
  dashboard: Dashboard | null;
  jobs: JobItem[];
  today: string;
  limited?: boolean;
};

export type WeekAmounts = {
  recordedRevenue: number;
  recordedCost: number;
  revenueEntries: number;
  costEntries: number;
};

export type WeeklyReview = {
  period: { start: string; through: string; compareStart: string; compareThrough: string };
  tasks: {
    open: number; overdue: number; reviewing: number; unassigned: number;
    owners: { owner: string; open: number; reviewing: number }[];
  };
  leads: {
    thisPeriod: number | null; comparison: number | null;
    byBusiness: { business: VentureId; count: number }[];
  };
  finance: { thisPeriod: WeekAmounts; comparison: WeekAmounts } | null;
  schedule: { nextSevenDaysExterior: number; nextSevenDaysEvents: number | null };
  priorities: IntelligenceSignal[];
  coverage: string[];
  snapshotLimited: boolean;
};

const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
function validDay(value:string): boolean {
  if(!dayPattern.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function offset(day:string,days:number):string {
  const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
/** Date/time stamps are assigned to the business day in America/Chicago. */
export function chicagoDay(value:string):string|null {
  if(validDay(value))return value;
  const d=new Date(value);
  if(!Number.isFinite(d.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(d);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value;
  const y=get('year'),m=get('month'),day=get('day');
  return y&&m&&day?`${y}-${m}-${day}`:null;
}
function inRange(day:string|null,from:string,to:string):boolean {
  return day!==null&&day>=from&&day<=to;
}
function sumFinance(finance:FinanceEntry[],start:string,end:string):WeekAmounts {
  return finance.reduce<WeekAmounts>((result,entry)=>{
    if(!Number.isFinite(entry.amount)||!inRange(chicagoDay(entry.occurred_on),start,end))return result;
    if(entry.kind==='revenue'){result.recordedRevenue+=entry.amount;result.revenueEntries++;}
    if(entry.kind==='cost'){result.recordedCost+=entry.amount;result.costEntries++;}
    return result;
  },{recordedRevenue:0,recordedCost:0,revenueEntries:0,costEntries:0});
}
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;

/**
 * Founder review of ALREADY-AUTHORIZED workspace records. This is a point-in-time
 * review, not a historical state transition report or consolidated accounting.
 * The prior comparison is the same number of Monday-through-current-day dates,
 * not a full prior week against a partial current week.
 */
export function buildWeeklyReview(input:WeeklyReviewInput):WeeklyReview {
  const {cards,dashboard,jobs,today,limited=false}=input;
  if(!validDay(today))throw new Error('Weekly review requires a real YYYY-MM-DD business date.');
  const dayOfWeek=new Date(today+'T00:00:00Z').getUTCDay();
  const daysSinceMonday=(dayOfWeek+6)%7;
  const start=offset(today,-daysSinceMonday);
  const compareStart=offset(start,-7);
  const compareThrough=offset(today,-7);
  const nextSeven=offset(today,6);
  const intel=buildIntelligence({cards,dashboard,jobs,today});
  const open=cards.filter(card=>card.stage!=='Done');
  const owners=new Map<string,{owner:string;open:number;reviewing:number}>();
  for(const card of open){
    const name=card.assignee.trim()||'Unassigned';
    const record=owners.get(name)||{owner:name,open:0,reviewing:0};
    record.open++;
    if(card.stage==='Review')record.reviewing++;
    owners.set(name,record);
  }
  const thisLeads=dashboard?.leads.filter(l=>inRange(chicagoDay(l.created_at),start,today));
  const prevLeads=dashboard?.leads.filter(l=>inRange(chicagoDay(l.created_at),compareStart,compareThrough));
  const byBusiness=new Map<VentureId,number>();
  for(const lead of thisLeads??[]){
    byBusiness.set(lead.venture,(byBusiness.get(lead.venture)||0)+1);
  }
  const currentFinance=dashboard?sumFinance(dashboard.finance,start,today):null;
  const priorFinance=dashboard?sumFinance(dashboard.finance,compareStart,compareThrough):null;
  const nextEvents=dashboard?.events.filter(e=>
    inRange(chicagoDay(e.starts_at),today,nextSeven)).length??null;
  const nextBookings=jobs.filter(j=>j.date>=today&&j.date<=nextSeven&&
    j.status!=='denied'&&j.status!=='cancelled').length;
  const coverage=[
    'Task counts are current board states, not tasks completed during this period.',
    dashboard
      ? 'Lead creation counts cover loaded workspace CRM records only; external provider activity may be missing.'
      : 'Workspace CRM and finance records were not supplied; their totals are unknown.',
    dashboard
      ? 'Finance entries are recorded amounts only, potentially including estimates; they are NOT verified cash received, expenses reconciled, profit or bank balances.'
      : 'No accounting, cash-collection or profit claim is possible without finance records.',
    'Exterior booking count covers loaded bookings only. An empty result does not prove there are no bookings.',
    dashboard?.reporting?.sources
      ? 'Provider status: '+dashboard.reporting.sources.map(s=>s.label+' ('+s.state+')').join(', ')+'.'
      : 'External-provider reporting coverage is not supplied.',
  ];
  if(limited)coverage.unshift('Workspace snapshot is truncated; all counts may understate actual records.');
  return {
    period:{start,through:today,compareStart,compareThrough},
    tasks:{
      open:open.length,overdue:intel.totals.overdueTasks,reviewing:intel.totals.reviewTasks,
      unassigned:intel.totals.unassignedTasks,
      owners:[...owners.values()].sort((a,b)=>b.open-a.open||a.owner.localeCompare(b.owner)),
    },
    leads:{thisPeriod:thisLeads?.length??null,comparison:prevLeads?.length??null,
      byBusiness:[...byBusiness].map(([business,count])=>({business,count})).sort((a,b)=>b.count-a.count||a.business.localeCompare(b.business))},
    finance:currentFinance&&priorFinance?{
      thisPeriod:{...currentFinance,recordedRevenue:round(currentFinance.recordedRevenue),recordedCost:round(currentFinance.recordedCost)},
      comparison:{...priorFinance,recordedRevenue:round(priorFinance.recordedRevenue),recordedCost:round(priorFinance.recordedCost)},
    }:null,
    schedule:{nextSevenDaysExterior:nextBookings,nextSevenDaysEvents:nextEvents},
    priorities:intel.signals.slice(0,8),
    coverage,snapshotLimited:limited,
  };
}

/** Deliberately no signatures, claims of approval, or external/customer send. */
export function weeklyReviewBrief(report:WeeklyReview):string {
  const money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
  return [
    'OJ HOLDINGS / FOUNDER WEEKLY REVIEW — INTERNAL DRAFT',
    'NOT A FINANCIAL STATEMENT, CUSTOMER MESSAGE, APPROVAL OR VERIFIED CASH REPORT',
    'Reporting dates: '+report.period.start+' through '+report.period.through+' (America/Chicago)',
    'Comparison: '+report.period.compareStart+' through '+report.period.compareThrough+' (same weekdays last week)',
    '',
    'CURRENT TASK BOARD',
    'Open: '+report.tasks.open+' | Overdue: '+report.tasks.overdue+' | Review stage: '+report.tasks.reviewing+' | Unassigned: '+report.tasks.unassigned,
    ...report.tasks.owners.map(o=>o.owner+': '+o.open+' open, '+o.reviewing+' in Review'),
    '',
    'WORKSPACE CRM LEADS CREATED (NOT OUTREACH OR SALES)',
    'Current: '+(report.leads.thisPeriod??'unknown')+' | Comparison: '+(report.leads.comparison??'unknown'),
    ...report.leads.byBusiness.map(b=>b.business+': '+b.count),
    '',
    'RECORDED FINANCE ENTRIES (NOT VERIFIED CASH OR PROFIT)',
    report.finance?'Current revenue-tagged entries: '+money(report.finance.thisPeriod.recordedRevenue)+' ('+report.finance.thisPeriod.revenueEntries+')':'Finance records not supplied',
    report.finance?'Current cost-tagged entries: '+money(report.finance.thisPeriod.recordedCost)+' ('+report.finance.thisPeriod.costEntries+')':'',
    '',
    'NEXT SEVEN DAYS (LOADED RECORDS)',
    'Exterior bookings: '+report.schedule.nextSevenDaysExterior,
    'Workspace events: '+(report.schedule.nextSevenDaysEvents??'unknown'),
    '',
    'ACTIONABLE ITEMS — OPEN SOURCE RECORDS IN THE WORKSPACE',
    ...(report.priorities.length?report.priorities.map(s=>'['+s.severity+'] '+s.title+' | '+s.source+' | '+s.destination):['No flagged items in the supplied records. This is not an all-clear.']),
    '',
    'COVERAGE / LIMITATIONS',...report.coverage,
    'Internal draft. Human review required. Nothing has been sent, posted, approved or changed.',
  ].filter(line=>line!=='').join('\n');
}
