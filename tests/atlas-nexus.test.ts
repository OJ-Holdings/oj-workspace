import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyCommercialPortfolio, savePortfolioProject } from '../src/lib/atlas-commercial-portfolio';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyFleet, type FleetAsset } from '../src/lib/fleet-command';
import { buildNexusGraph } from '../src/lib/atlas-nexus';
import type { Activity, Card } from '../src/lib/board';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const org = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const first = 'projectA';
const second = 'projectB';
const bookingA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bookingB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const lastSave = '2026-10-22T17:00:00.000Z';
const day = '2026-10-23';

function portfolio(){
  const base=emptyCommercialPortfolio(org);
  const estimateA=newEstimate();
  estimateA.sites[0] = {
    ...estimateA.sites[0],name:'Building A',location:'PRIVATE PROPERTY ADDRESS',
    notes:'PRIVATE CUSTOMER NOTES',crewHours:24,access:'lift',liftDays:0,
  };
  const estimateB=newEstimate();
  estimateB.sites[0].crewHours=12;
  const a=savePortfolioProject(base,org,first,{
    name:'Alpha commercial',
    input:estimateA,review:[false,false,false,false,false],
    phase:'founder-review',bookingId:bookingA,plannedAssetIds:['washer-1','not-found'],
    fieldCrewPlan:{crewSize:2,productiveHoursPerPersonDay:4,plannedFieldDays:2,
      stagingNote:'PRIVATE STAFF ACCESS PASSCODE'},
  },null,lastSave);
  return savePortfolioProject(a,org,second,{
    name:'Beta commercial',
    input:estimateB,review:[true,true,true,true,true],
    phase:'scoping',bookingId:bookingB,plannedAssetIds:['washer-1'],
    fieldCrewPlan:{crewSize:2,productiveHoursPerPersonDay:6,plannedFieldDays:1,stagingNote:''},
  },null,'2026-10-22T18:00:00.000Z');
}
const fleet=()=>{
  const f=emptyFleet(org);
  const item:FleetAsset={
    id:'washer-1',name:'Field washer',kind:'pressure-washer',model:'GX390',
    status:'needs-service',unit:'hours',reading:90,nextServiceReading:100,
    nextServiceDate:'2026-11-03',
    notes:'PRIVATE FLEET MECHANIC INFORMATION',
    createdAt:'2026-10-10T12:00:00.000Z',
  };
  f.assets=[item];return f;
};
const jobs:JobItem[]=[
  {id:bookingA,lead_id:'leadA',date:'2026-10-25',time_block:'9 to 12',
    status:'confirmed',name:'PRIVATE CUSTOMER A',service:'Commercial window cleaning',
    address:'PRIVATE STREET ADDRESS',quote:38000},
  {id:bookingB,lead_id:'leadB',date:'2026-10-25',time_block:'12 to 3',
    status:'confirmed',name:'PRIVATE CUSTOMER B',service:'Commercial window cleaning',
    address:'PRIVATE STREET B',quote:12000},
];
const task=(id:string,description:string,orgId=org,stage:Card['stage']='Ready'):Card=>({
  id,organization_id:orgId,title:'Review external access',description,business:'exterior',
  stage,priority:'normal',assignee:'Jacob',due_date:'2026-10-22',revision:1,checklist:[],
});
const tasks:Card[]=[
  task('t1','Local portfolio project ID: projectA'),
  task('t2','Local portfolio project ID: projectB',org,'Done'),
  task('t3','Project A: inspect washer but no exact ID'),
  task('foreign','Local portfolio project ID: projectA',foreign),
  task('orph','Local portfolio project ID: not-on-this-device'),
  task('other-venture','Local portfolio project ID: projectA',org),
];
tasks[5].business='solutions';
const activity:Activity[]=[
  {id:'act1',card_id:'t1',actor:'Founder 1',action:'card_created',created_at:'2026-10-22T18:00:00.000Z'},
  {id:'act2',card_id:'t1',actor:'Founder 2',action:'card_updated',created_at:'2026-10-22T19:00:00.000Z'},
  {id:'actForeign',card_id:'foreign',actor:'PRIVATE CROSS TENANT',action:'comment_added',created_at:'2026-10-22T19:30:00.000Z'},
  {id:'actOther',card_id:'t3',actor:'Fuzzy source',action:'card_created',created_at:'2026-10-22T19:30:00.000Z'},
];
const build=(overrides:Partial<Parameters<typeof buildNexusGraph>[0]>={})=>buildNexusGraph({
  org,portfolio:portfolio(),fleet:fleet(),bookings:jobs,
  bookingsState:'ready',cards:tasks,activity,day,...overrides,
});

test('NEXUS builds a usable 360 view from exact source links without inventing server project identity',()=>{
  const graph=build();
  assert.equal(graph.totals.projects,2);
  assert.equal(graph.totals.scopedBuildings,2);
  assert.equal(graph.totals.exactLoadedBookingLinks,2);
  assert.equal(graph.totals.taskReceiptLinks,2);
  assert.equal(graph.totals.localAssetCandidates,3);
  assert.equal(graph.totals.sourceActivityEvents,2);
  assert.equal(graph.taskOrphans,1);
  assert.equal(graph.projects[0].id,first); // attention-first ordering
  const p=graph.projects.find(x=>x.id===first)!;
  assert.equal(p.scope.paidCrewHours,24);
  assert.equal(p.crew.capacityGapHours,-8);
  assert.equal(p.booking.date,'2026-10-25');
  assert.equal(p.booking.timeBlock,'9 to 12');
  assert.equal(p.tasks[0].id,'t1');
  assert.equal(p.assets.length,2);
  assert.equal(p.activity.length,2);
  assert.deepEqual(p.activity.map(x=>x.actor),['Founder 2','Founder 1']);
  assert.equal(p.relations.find(x=>x.kind==='booking')?.evidence,'loaded-source');
  assert.equal(p.relations.find(x=>x.kind==='task')?.evidence,'textual-receipt');
  assert.equal(p.relations.find(x=>x.sourceId==='not-found')?.evidence,'unverified');
  assert.ok(p.findings.some(x=>x.id==='crew-shortfall'&&x.severity==='attention'));
  assert.ok(p.findings.some(x=>x.id==='same-day-assets'&&x.severity==='review'));
  assert.ok(p.findings.some(x=>x.id==='tasks-overdue'&&x.severity==='attention'));
});

test('when booking source is pending or failed, graph cannot invent confirmed bookings or dates',()=>{
  for(const state of ['loading','failed'] as const){
    const result=build({bookingsState:state});
    assert.equal(result.sources.bookings,state);
    assert.equal(result.totals.exactLoadedBookingLinks,0);
    assert.equal(result.projects.every(p=>p.booking.date===null),true);
    assert.equal(result.projects.every(p=>p.booking.status===(state==='failed'?'source-failed':'loading')),true);
    assert.equal(result.projects.some(p=>p.findings.some(f=>f.id==='same-day-assets')),false);
  }
});

test('cancelled and unobserved exact booking IDs are not marked active',()=>{
  const cancelled=build({bookings:[{...jobs[0],status:'cancelled'},jobs[1]]});
  const p=cancelled.projects.find(x=>x.id===first)!;
  assert.equal(p.booking.status,'inactive');
  assert.equal(p.booking.date,null);
  assert.equal(p.findings.some(x=>x.id==='booking-inactive'&&x.severity==='attention'),true);
  const missing=build({bookings:[jobs[1]]});
  assert.equal(missing.projects.find(x=>x.id===first)?.booking.status,'not-in-loaded-source');
  assert.equal(missing.projects.find(x=>x.id===first)?.booking.date,null);
});

test('cross-organization portfolio or Fleet sources fail closed',()=>{
  assert.throws(()=>build({org:foreign}),/Cross-organization/);
  assert.throws(()=>build({fleet:{...fleet(),organizationId:foreign}}),/Cross-organization/);
});

test('textual task receipts do not manufacture links from fuzzy names or cross-tenant tasks',()=>{
  const graph=build();
  const alpha=graph.projects.find(x=>x.id===first)!;
  assert.deepEqual(alpha.tasks.map(t=>t.id),['t1']);
  assert.deepEqual(alpha.activity.map(x=>x.id),['act2','act1']);
  assert.equal(alpha.findings.some(f=>f.detail.includes('PRIVATE CROSS TENANT')),false);
});

test('private source content is not carried into the NEXUS graph or serialized source edges',()=>{
  const serialized=JSON.stringify(build());
  for(const secret of [
    'PRIVATE PROPERTY ADDRESS','PRIVATE CUSTOMER NOTES','PRIVATE STAFF ACCESS PASSCODE',
    'PRIVATE FLEET MECHANIC INFORMATION','PRIVATE CUSTOMER A','PRIVATE STREET ADDRESS',
    'PRIVATE CUSTOMER B','PRIVATE STREET B','38000','12000','PRIVATE CROSS TENANT',
  ]) assert.equal(serialized.includes(secret),false,secret);
  assert.match(serialized,/Entered workforce capacity is/);
});

test('missing Fleet workbook means unknown asset conditions, not empty or deployable assets',()=>{
  const graph=build({fleet:null});
  assert.equal(graph.sources.fleet,'missing-or-unverified');
  const alpha=graph.projects.find(p=>p.id===first)!;
  assert.equal(alpha.assets.length,2);
  assert.ok(alpha.assets.every(x=>x.state==='missing'));
  assert.ok(alpha.findings.some(f=>f.id==='fleet-unavailable'));
  assert.ok(alpha.relations.filter(x=>x.kind==='asset').every(r=>r.evidence==='unverified'));
});

test('NEXUS never generates fabricated activity when no task events are loaded',()=>{
  const graph=build({activity:[]});
  assert.equal(graph.totals.sourceActivityEvents,0);
  assert.equal(graph.sources.activity,'no-source-events-loaded');
  assert.ok(graph.projects.every(p=>p.activity.length===0));
  // Project local revision timestamp remains distinct from task activity.
  assert.equal(graph.projects[0].updatedAt,lastSave);
});

test('empty local projects produce explicit zero coverage, not sample customer records',()=>{
  const graph=build({
    portfolio:emptyCommercialPortfolio(org),fleet:emptyFleet(org),
    bookings:[],cards:[],activity:[],
  });
  assert.deepEqual(graph.projects,[]);
  assert.equal(graph.totals.projects,0);
  assert.equal(graph.totals.exactLoadedBookingLinks,0);
  assert.equal(graph.sources.tasks,'loaded-workspace-snapshot');
});
