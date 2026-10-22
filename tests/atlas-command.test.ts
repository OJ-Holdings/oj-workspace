import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasModes, atlasSignalsForMode, buildAtlasSnapshot } from '../src/lib/atlas-command';
import type { Card } from '../src/lib/board';
import type { Dashboard } from '../src/lib/dashboard';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const today='2026-10-22';
const card=(id:string,overrides:Partial<Card>={}):Card=>({
  id,organization_id:'authorized',title:'Task '+id,description:'',business:'exterior',
  stage:'Ready',priority:'normal',assignee:'Oscar',due_date:'',revision:0,checklist:[],
  ...overrides,
});
const dashboard=(overrides:Partial<Dashboard>={}):Dashboard=>({
  leads:[],finance:[],metricEntries:[],events:[],documents:[],messages:[],...overrides,
});
const booking=(id:string,date:string,status='confirmed'):JobItem=>({
  id,lead_id:'lead-'+id,date,status,time_block:'8 AM',name:'Service '+id,
  service:'Commercial windows',address:null,quote:null,
});

test('ATLAS exposes five intentional modes, but no standalone Connected Operations mode',()=>{
  assert.deepEqual([...atlasModes],['today','operations','growth','money','strategy']);
});

test('four venture strip includes disabled studio without pretending it has live CRM data',()=>{
  const snap=buildAtlasSnapshot({today,cards:[card('a',{business:'exterior'})],
    dashboard:dashboard(),jobs:[]});
  assert.deepEqual(snap.ventures.map(v=>v.id),['exterior','solutions','essentials','content']);
  assert.equal(snap.ventures.find(v=>v.id==='content')?.active,false);
  assert.equal(snap.ventures.find(v=>v.id==='content')?.leads,null);
  assert.equal(snap.ventures.find(v=>v.id==='exterior')?.openTasks,1);
});

test('missions use only observed task state; no completion/sale inferred',()=>{
  const snap=buildAtlasSnapshot({today,cards:[
    card('late',{due_date:'2026-10-21',assignee:''}),
    card('review',{stage:'Review',assignee:'Jacob'}),
    card('done',{stage:'Done',due_date:'2026-10-20'}),
  ],dashboard:dashboard(),jobs:[]});
  assert.equal(snap.intelligence.totals.openTasks,2);
  assert.equal(snap.intelligence.totals.overdueTasks,1);
  assert.equal(snap.intelligence.totals.reviewTasks,1);
  assert.equal(snap.intelligence.totals.unassignedTasks,1);
  assert.equal(snap.founders.find(f=>f.name==='Unassigned')?.overdue,1);
  assert.equal(snap.founders.find(f=>f.name==='Jacob')?.inReview,1);
  assert.ok(atlasSignalsForMode(snap,'operations').every(s=>['Execution','Schedule'].includes(s.category)));
});

test('seven calendar dates only, cancelled bookings excluded, events source-linked',()=>{
  const snap=buildAtlasSnapshot({today,cards:[],jobs:[
    booking('today',today),
    booking('last','2026-10-28'),
    booking('too-late','2026-10-29'),
    booking('cancelled',today,'cancelled'),
  ],dashboard:dashboard({events:[
    {id:'e1',venture:'solutions',title:'Demo',location:'Online',notes:'',
      starts_at:'2026-10-23T16:00:00.000Z',ends_at:null,all_day:false},
  ]})});
  assert.equal(snap.intelligence.totals.upcomingExterior,2);
  assert.equal(snap.schedule.length,3);
  assert.ok(!snap.schedule.some(s=>s.key==='booking:too-late'||s.key==='booking:cancelled'));
  assert.equal(snap.schedule.find(s=>s.key==='event:e1')?.href,'/calendar?event=e1');
});

test('recorded finance entries are not marked as actual paid or profit',()=>{
  const snap=buildAtlasSnapshot({today,cards:[],jobs:[],dashboard:dashboard({finance:[
    {id:'f1',venture:'exterior',kind:'revenue',amount:1200,occurred_on:'2026-10-20',category:'Estimate',note:''},
    {id:'f2',venture:'exterior',kind:'cost',amount:300,occurred_on:'2026-10-19',category:'Budget',note:''},
    {id:'f3',venture:'exterior',kind:'revenue',amount:900,occurred_on:'2026-09-20',category:'Previous',note:''},
  ]})});
  assert.equal(snap.finance.recordedRevenue,1200);
  assert.equal(snap.finance.recordedCosts,300);
  assert.equal(snap.finance.revenueEntries,1);
  assert.match(snap.notes.join(' '),/not verified collected cash/);
  assert.ok(!Object.hasOwn(snap.finance,'profit'));
});

test('missing workspace source is unknown and capped snapshot is disclosed',()=>{
  const snap=buildAtlasSnapshot({today,cards:[],dashboard:null,jobs:[],limited:true});
  assert.equal(snap.finance.available,false);
  assert.equal(snap.sourceState,'unknown');
  assert.equal(snap.sourceIssues,null);
  assert.equal(snap.currentEvents,null);
  assert.equal(snap.ventures.find(v=>v.id==='exterior')?.leads,null);
  assert.match(snap.notes.join(' '),/capped/);
  assert.match(snap.notes.join(' '),/unavailable/);
});

test('provider states remain partial/unknown, not invented health',()=>{
  const snap=buildAtlasSnapshot({today,cards:[],jobs:[],dashboard:dashboard({reporting:{
    exterior:{jobs:10,revenueJobs:6,costJobs:2,matchedJobs:1,estimatedDateJobs:3},
    sources:[{id:'exterior',label:'Exterior',state:'partial',detail:'Some jobs not loaded'}],
  }})});
  assert.equal(snap.sourceState,'partial');
  assert.equal(snap.sourceIssues,1);
  assert.ok(atlasSignalsForMode(snap,'money').every(s=>s.category==='Data integrity'));
  assert.ok(atlasSignalsForMode(snap,'strategy').every(s=>s.severity==='urgent'||s.severity==='attention'));
});
