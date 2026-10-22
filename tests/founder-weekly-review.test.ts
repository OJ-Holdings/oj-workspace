import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeeklyReview, chicagoDay, weeklyReviewBrief } from '../src/lib/founder-weekly-review';
import type { Card } from '../src/lib/board';
import type { Dashboard } from '../src/lib/dashboard';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const day='2026-10-22';
const card=(id:string,overrides:Partial<Card>={}):Card=>({
  id,organization_id:'test-org',title:'Work '+id,description:'',business:'exterior',
  stage:'In progress',priority:'normal',assignee:'Oscar',due_date:'',revision:0,
  checklist:[],...overrides,
});
const dash=(overrides:Partial<Dashboard>={}):Dashboard=>({
  leads:[],finance:[],events:[],documents:[],messages:[],metricEntries:[],...overrides,
});
const job=(id:string,date:string,status:string|null='scheduled'):JobItem=>({
  id,lead_id:id+'-lead',date,time_block:'9 AM',status,name:'Example '+id,
  service:'Window Cleaning',address:null,quote:null,
});
const lead=(id:string,created_at:string,venture:'exterior'|'solutions'='exterior')=>({
  id,created_at,venture,name:id,contact:'',stage:'New' as const,value:null,source:'',notes:'',
});

test('Monday through current day compares against the same weekdays last week',()=>{
  const report=buildWeeklyReview({cards:[],jobs:[],dashboard:dash(),today:day});
  assert.deepEqual(report.period,{
    start:'2026-10-19',through:'2026-10-22',
    compareStart:'2026-10-12',compareThrough:'2026-10-15',
  });
  assert.equal(buildWeeklyReview({cards:[],jobs:[],dashboard:dash(),today:'2026-10-25'}).period.start,'2026-10-19');
  assert.equal(buildWeeklyReview({cards:[],jobs:[],dashboard:dash(),today:'2026-10-26'}).period.start,'2026-10-26');
});

test('timestamp boundaries use Chicago date, not UTC date',()=>{
  assert.equal(chicagoDay('2026-10-19T03:30:00Z'),'2026-10-18');
  assert.equal(chicagoDay('2026-10-19T06:00:00Z'),'2026-10-19');
  assert.equal(chicagoDay('2026-10-22'),'2026-10-22');
  assert.equal(chicagoDay('not a date'),null);
});

test('weekly CRM counts use creation timestamps and explicit source scope',()=>{
  const report=buildWeeklyReview({cards:[],jobs:[],today:day,dashboard:dash({leads:[
    lead('prior','2026-10-14T14:00:00Z'),
    lead('current','2026-10-22T20:00:00Z','solutions'),
    lead('sunday-local','2026-10-19T03:30:00Z'),
    lead('old','2026-10-12T01:00:00Z'),
  ]})});
  assert.equal(report.leads.thisPeriod,1);
  assert.equal(report.leads.comparison,1);
  assert.deepEqual(report.leads.byBusiness,[{business:'solutions',count:1}]);
  assert.match(report.coverage.join(' '),/external provider activity may be missing/i);
});

test('no reporting snapshot means unknown finance and leads, not zeros',()=>{
  const report=buildWeeklyReview({cards:[],jobs:[],today:day,dashboard:null});
  assert.equal(report.leads.thisPeriod,null);
  assert.equal(report.leads.comparison,null);
  assert.equal(report.finance,null);
  assert.equal(report.schedule.nextSevenDaysEvents,null);
  assert.match(weeklyReviewBrief(report),/Finance records not supplied/);
  assert.doesNotMatch(weeklyReviewBrief(report),/verified profit/i);
});

test('recorded finance amounts never become claimed net profit or actual cash',()=>{
  const report=buildWeeklyReview({cards:[],jobs:[],today:day,dashboard:dash({finance:[
    {id:'r',venture:'exterior',kind:'revenue',amount:500,occurred_on:day,category:'work',note:'estimated'},
    {id:'c',venture:'exterior',kind:'cost',amount:180,occurred_on:day,category:'supplies',note:''},
    {id:'last',venture:'exterior',kind:'revenue',amount:90,occurred_on:'2026-10-13',category:'job',note:''},
    {id:'future',venture:'exterior',kind:'revenue',amount:999,occurred_on:'2026-10-23',category:'job',note:''},
  ]})});
  assert.equal(report.finance?.thisPeriod.recordedRevenue,500);
  assert.equal(report.finance?.thisPeriod.recordedCost,180);
  assert.equal(report.finance?.comparison.recordedRevenue,90);
  assert.equal(report.finance?.thisPeriod.revenueEntries,1);
  const brief=weeklyReviewBrief(report);
  assert.match(brief,/NOT VERIFIED CASH OR PROFIT/);
  assert.doesNotMatch(brief,/profit: \$/i);
});

test('tasks are current states, never retrospectively labelled weekly completions',()=>{
  const report=buildWeeklyReview({today:day,jobs:[],dashboard:dash(),cards:[
    card('late',{due_date:'2026-10-20',assignee:'',stage:'Review'}),
    card('done',{due_date:'2026-10-19',stage:'Done'}),
    card('active',{assignee:'Jacob'}),
  ]});
  assert.equal(report.tasks.open,2);
  assert.equal(report.tasks.overdue,1);
  assert.equal(report.tasks.reviewing,1);
  assert.equal(report.tasks.unassigned,1);
  assert.deepEqual(report.tasks.owners.map(x=>x.owner),['Jacob','Unassigned']);
  assert.equal(report.priorities[0].destination,'/tasks?task=late');
  assert.match(report.coverage[0],/not tasks completed/i);
});

test('bookings exclude cancelled and denied, events are separately described',()=>{
  const report=buildWeeklyReview({cards:[],today:day,jobs:[
    job('now','2026-10-22'),job('six','2026-10-28'),
    job('seventh','2026-10-29'),job('old','2026-10-21'),
    job('cancel','2026-10-23','cancelled'),job('denied','2026-10-24','denied'),
  ],dashboard:dash({events:[
    {id:'one',venture:null,title:'Review',starts_at:'2026-10-23T18:00:00Z',ends_at:null,all_day:false,location:'',notes:''},
  ]})});
  assert.equal(report.schedule.nextSevenDaysExterior,2);
  assert.equal(report.schedule.nextSevenDaysEvents,1);
});

test('invalid dates rejected and truncated snapshots prominently disclosed',()=>{
  for(const today of ['','2026-02-30','2026/10/22','invalid']){
    assert.throws(()=>buildWeeklyReview({today,cards:[],jobs:[],dashboard:null}));
  }
  const report=buildWeeklyReview({cards:[],jobs:[],today:day,dashboard:null,limited:true});
  assert.equal(report.snapshotLimited,true);
  assert.match(report.coverage[0],/truncated/);
  assert.match(weeklyReviewBrief(report),/NOT A FINANCIAL STATEMENT/);
});
