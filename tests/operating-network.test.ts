import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperatingNetwork, explicitCrmLeadIds } from '../src/lib/operating-network';
import { searchWorkspace } from '../src/lib/workspace-search';
import type { Card } from '../src/lib/board';
import type { Dashboard } from '../src/lib/dashboard';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const today='2026-10-22';
const card=(id:string,overrides:Partial<Card>={}):Card=>({
  id,organization_id:'the-org',title:'Task '+id,description:'',
  business:'exterior',stage:'In progress',priority:'normal',assignee:'Oscar',
  due_date:'',revision:0,checklist:[],...overrides,
});
const dash=(overrides:Partial<Dashboard>={}):Dashboard=>({
  leads:[],finance:[],events:[],documents:[],messages:[],metricEntries:[],...overrides,
});
const lead=(id:string,venture:'exterior'|'solutions'='exterior')=>({
  id,name:'Lead '+id,venture,contact:'contact',stage:'New' as const,
  value:null,source:'manual',notes:'',created_at:'2026-10-20T12:00:00Z',
});
const booking=(id:string,day:string,status:string|null='scheduled'):JobItem=>({
  id,lead_id:'ex-'+id,date:day,time_block:'9 AM',status,name:'Customer '+id,
  service:'Window Cleaning',address:'Example property',quote:null,
});

test('all seven operational record types appear with stable source routes',()=>{
  const dashboard=dash({
    leads:[lead('l1')],
    events:[{id:'e1',venture:null,title:'Team planning',starts_at:'2026-10-23T16:00:00Z',
      ends_at:null,all_day:false,location:'Office',notes:''}],
    documents:[{id:'d1',venture:'exterior',name:'Insurance file',tag:'insurance',
      storage_path:'private',size_bytes:2,mime:'application/pdf',uploaded_by:'Oscar',
      created_at:'2026-10-20T12:00:00Z'}],
    finance:[{id:'f1',venture:'exterior',kind:'revenue',amount:1200,occurred_on:today,
      category:'Quoted project',note:'Uncollected'}],
    messages:[{id:'m1',venture:null,author:'Jacob',body:'Confirm survey with client',
      created_at:'2026-10-20T12:00:00Z'}],
  });
  const result=buildOperatingNetwork({cards:[card('t1')],dashboard,jobs:[booking('b1',today)],today});
  assert.deepEqual(new Set(result.records.map(r=>r.kind)),
    new Set(['task','lead','booking','event','document','finance','message']));
  assert.equal(result.loaded,7);
  assert.equal(result.records.find(r=>r.kind==='event')?.href,'/calendar?event=e1');
  assert.equal(result.records.find(r=>r.kind==='document')?.href,'/files?document=d1');
  assert.equal(result.records.find(r=>r.kind==='finance')?.href,'/finance');
  assert.equal(result.records.find(r=>r.kind==='booking')?.href,'/b/exterior/calendar');
  assert.ok(result.records.every(r=>r.href.startsWith('/')&&!r.href.startsWith('//')));
  assert.equal(result.records.find(r=>r.kind==='finance')?.detail.includes('1200'),false);
});

test('task relationships require exact loaded CRM ID in same business',()=>{
  const result=buildOperatingNetwork({today,jobs:[],dashboard:dash({leads:[lead('e-12'),lead('s-9','solutions')]}),
    cards:[
      card('match',{description:'Review /crm?lead=e-12'}),
      card('cross-business',{description:'Review /crm?lead=s-9'}),
      card('unknown',{description:'Review /crm?lead=absent'}),
      card('name-matches',{description:'Call Lead e-12 about job.'}),
    ]});
  assert.equal(result.relations.length,1);
  assert.equal(result.relations[0].fromKey,'task:match');
  assert.equal(result.relations[0].toKey,'lead:e-12');
  assert.equal(result.relations[0].href,'/crm?lead=e-12');
  assert.match(result.relations[0].provenance,/Exact CRM record ID/);
});

test('booking relationship uses Exterior source ID, never guesses workspace CRM ID',()=>{
  const result=buildOperatingNetwork({today,cards:[],jobs:[booking('b7','2026-10-24')],
    dashboard:dash({leads:[lead('ex-b7')]})});
  assert.equal(result.relations.length,1);
  assert.equal(result.relations[0].toKey,null);
  assert.equal(result.relations[0].href,'/b/exterior/leads?lead=ex-b7');
  assert.match(result.relations[0].provenance,/separate from workspace CRM/);
});

test('overdue task and upcoming booking prioritize correctly with cancellation exclusions',()=>{
  const result=buildOperatingNetwork({today,dashboard:dash(),cards:[
    card('done',{stage:'Done',due_date:'2026-10-17'}),
    card('late',{due_date:'2026-10-20',assignee:''}),
    card('review',{stage:'Review',assignee:'Jacob'}),
    card('soon',{due_date:'2026-10-27'}),
  ],jobs:[
    booking('today',today),booking('future','2026-10-28'),
    booking('outside','2026-10-29'),booking('cancel',today,'cancelled'),
    booking('denied',today,'denied'),
  ]});
  assert.deepEqual(result.counts,{overdue:1,review:1,unassigned:1,
    upcomingBookings:2,dueNextSeven:1});
  assert.equal(result.records[0].key,'task:late');
  assert.ok(!result.records.some(r=>r.key==='booking:cancel'||r.key==='booking:denied'));
});

test('missing dashboard and limited source snapshot are disclosed as unknown',()=>{
  const result=buildOperatingNetwork({cards:[],jobs:[],dashboard:null,today,limited:true});
  assert.equal(result.loaded,0);
  assert.equal(result.dashboardAvailable,false);
  assert.match(result.warnings.join(' '),/unavailable/i);
  assert.match(result.warnings.join(' '),/may understate/i);
  assert.equal(result.coverage.find(x=>x.business==='content')?.tasks,0);
  assert.ok(result.warnings.some(s=>/zero loaded items is not proof/i.test(s)));
});

test('bad business date is rejected and malformed reference never creates phantom link',()=>{
  for(const value of ['2026-02-30','2026/10/22','nonsense','']){
    assert.throws(()=>buildOperatingNetwork({cards:[],dashboard:null,jobs:[],today:value}));
  }
  assert.deepEqual(explicitCrmLeadIds('https://site.example/crm?lead=%xy'),[]);
  assert.deepEqual(explicitCrmLeadIds('/crm?lead=abc and /crm?lead=abc'),['abc']);
});

test('global command search includes authorized Exterior bookings and omits cancelled',()=>{
  const b=[booking('one',today),booking('cancel',today,'cancelled')];
  const found=searchWorkspace('Customer',[],dash(),b);
  assert.deepEqual(found.map(x=>x.id),['one']);
  assert.equal(found[0].kind,'Booking');
  assert.equal(found[0].path,'/b/exterior/calendar');
  assert.ok(!searchWorkspace('not-here',[],dash(),b).length);
});

test('large record lists are capped and warn about incomplete index, without phantom counts',()=>{
  const many=Array.from({length:2530},(_,i)=>card(String(i)));
  const result=buildOperatingNetwork({cards:many,dashboard:dash(),jobs:[],today});
  assert.equal(result.loaded,2530);
  assert.equal(result.shown,2500);
  assert.equal(result.capped,true);
  assert.match(result.warnings[0],/first 2,500/);
  assert.equal(result.coverage.find(s=>s.business==='exterior')?.tasks,2530);
});
