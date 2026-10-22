import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIntelligence } from '../src/lib/corporate-intelligence';
import type { Card } from '../src/lib/board';
import type { Dashboard } from '../src/lib/dashboard';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const today = '2026-10-22';
const task = (id: string, overrides: Partial<Card> = {}): Card => ({
  id, organization_id:'test-company', title:'Task '+id, description:'',
  business:'exterior', stage:'In progress',priority:'normal',assignee:'Oscar',
  due_date:'',revision:0,checklist:[],...overrides,
});
const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  leads:[],documents:[],finance:[],messages:[],events:[],metricEntries:[],...overrides,
});
const job = (id: string, day: string, status: string | null = 'scheduled'): JobItem => ({
  id,lead_id:'lead-'+id,date:day,time_block:'9 AM',status,name:'Customer '+id,
  service:'Window Cleaning',address:null,quote:null,
});

test('uncompleted overdue work is ranked ahead of due-today, reviews and high-priority work', () => {
  const cards = [
    task('high',{priority:'high'}),
    task('review',{stage:'Review'}),
    task('today',{due_date:today}),
    task('late',{due_date:'2026-10-21'}),
    task('done',{due_date:'2026-10-11',stage:'Done'}),
  ];
  const report=buildIntelligence({cards,dashboard:dashboard(),jobs:[],today});
  assert.equal(report.totals.overdueTasks,1);
  assert.equal(report.totals.dueToday,1);
  assert.equal(report.totals.reviewTasks,1);
  assert.deepEqual(report.signals.map(signal=>signal.id),
    ['task:late','task:today','task:review','task:high']);
  assert.equal(report.signals[0].destination,'/tasks?task=late');
  assert.equal(report.totals.openTasks,4);
});

test('a card never becomes multiple alerts due to overlapping conditions', () => {
  const cards=[task('many',{due_date:'2026-10-20',stage:'Review',priority:'high',assignee:''})];
  const report=buildIntelligence({cards,dashboard:dashboard(),jobs:[],today});
  assert.equal(report.signals.length,1);
  assert.equal(report.totals.unassignedTasks,1);
  assert.equal(report.totals.reviewTasks,1);
  assert.equal(report.signals[0].severity,'urgent');
});

test('lead stage follow-up signals are based on creation age, not invented contact histories', () => {
  const leads=[
    {id:'older',venture:'solutions' as const,name:'Example Lead',contact:'',stage:'New' as const,
      value:null,source:'',notes:'',created_at:'2026-10-10T12:00:00Z'},
    {id:'new',venture:'solutions' as const,name:'Fresh Lead',contact:'',stage:'New' as const,
      value:null,source:'',notes:'',created_at:'2026-10-20T12:00:00Z'},
    {id:'proposal',venture:'exterior' as const,name:'Proposal',contact:'',stage:'Proposal' as const,
      value:null,source:'',notes:'',created_at:'2026-10-01T12:00:00Z'},
    {id:'won',venture:'solutions' as const,name:'Won',contact:'',stage:'Won' as const,
      value:null,source:'',notes:'',created_at:'2026-08-01T12:00:00Z'},
  ];
  const report=buildIntelligence({cards:[],dashboard:dashboard({leads}),jobs:[],today});
  assert.equal(report.totals.pipelineNeedsReview,2);
  assert.deepEqual(report.signals.map(s=>s.id),['lead:older','lead:proposal']);
  assert.match(report.signals[0].explanation,/may have been used/);
  assert.match(report.signals[1].explanation,/does not establish/);
  assert.equal(report.coverage.sharedLeads,4);
});

test('booking signals exclude cancelled, denied, old and out-of-range records', () => {
  const jobs=[
    job('today',today),job('seven','2026-10-29'),job('too-late','2026-10-30'),
    job('old','2026-10-21'),job('cancel','2026-10-23','cancelled'),
    job('denied','2026-10-24','denied'),
  ];
  const report=buildIntelligence({cards:[],dashboard:dashboard(),jobs,today});
  assert.equal(report.totals.upcomingExterior,2);
  assert.equal(report.coverage.exteriorBookings,6);
  assert.deepEqual(report.signals.map(s=>s.id),['booking:today','booking:seven']);
  assert.equal(report.signals[0].severity,'attention');
  assert.equal(report.signals[1].severity,'informational');
});

test('missing entire provider reporting is unknown rather than a healthy zero', () => {
  const a=buildIntelligence({cards:[],dashboard:null,jobs:[],today});
  assert.equal(a.coverage.sharedLeads,null);
  assert.equal(a.coverage.providers,'not-supplied');
  assert.equal(a.coverage.completedExteriorJobs,null);
  assert.equal(a.totals.incompleteSources,null);
  assert.equal(a.signals.length,0);
});

test('missing exterior costs and recorded revenue are treated as data gaps, never losses', () => {
  const report=buildIntelligence({cards:[],dashboard:dashboard({reporting:{
    sources:[{id:'exterior',label:'Exterior Care',state:'available',detail:'Verified read'},
      {id:'shopify',label:'Shopify',state:'partial',detail:'Some orders missing'},
      {id:'ghl',label:'GoHighLevel',state:'not-connected',detail:'No connection'}],
    exterior:{jobs:12,revenueJobs:8,costJobs:3,matchedJobs:2,estimatedDateJobs:0},
  }}),jobs:[],today});
  assert.equal(report.totals.incompleteSources,2);
  assert.equal(report.coverage.completedExteriorJobs,12);
  assert.equal(report.coverage.exteriorCostsRecorded,3);
  assert.equal(report.signals.find(x=>x.id==='exterior:cost-coverage')?.title,
    '9 completed-job records missing costs');
  assert.match(report.signals.find(x=>x.id==='exterior:revenue-coverage')!.explanation,/does not verify actual cash/);
  assert.ok(report.signals.some(x=>x.id==='source:shopify'));
  assert.ok(report.signals.some(x=>x.id==='source:ghl'));
});

test('proposed actions route to authorized in-app records only', () => {
  const report=buildIntelligence({cards:[task('A/B #1',{stage:'Review'})],
    dashboard:dashboard(),jobs:[],today});
  assert.equal(report.signals[0].destination,'/tasks?task=A%2FB%20%231');
  for(const signal of report.signals){
    assert.ok(signal.destination.startsWith('/'));
    assert.ok(!signal.destination.startsWith('//'));
    assert.ok(signal.source);
  }
});

test('invalid reporting date fails rather than emitting misleading priorities', () => {
  for(const invalid of ['', 'today','2026/10/22','garbage']) {
    assert.throws(()=>buildIntelligence({cards:[],dashboard:dashboard(),jobs:[],today:invalid}));
  }
});
