import assert from 'node:assert/strict';
import test from 'node:test';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyCommercialPortfolio, savePortfolioProject } from '../src/lib/atlas-commercial-portfolio';
import { emptyFleet, type FleetAsset } from '../src/lib/fleet-command';
import { buildCorporateNexusOverlay } from '../src/lib/atlas-nexus-corporate';
import type { JobItem } from '../src/app/workspace/exterior-actions';
import type { Card, Activity } from '../src/lib/board';

const org='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const booking='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const old='2026-10-20T20:00:00.000Z';
const today='2026-10-23';
const estimate=newEstimate();
estimate.sites[0]={...estimate.sites[0],crewHours:16,access:'lift',liftDays:0,panes:100};
const work=(id:string,description:string,organization_id=org):Card=>({
  id,organization_id,title:'Review field needs',description,business:'exterior',
  stage:'In progress',priority:'normal',assignee:'',due_date:'',revision:0,checklist:[],
});
const sourceJob:JobItem={
  id:booking,lead_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  date:'2026-11-06',time_block:'9 to 12',status:'confirmed',
  name:'Private Customer',address:'PRIVATE ADDRESS',service:'Window cleaning',quote:39000,
};
const sourceAsset: FleetAsset={
  id:'washer-01',name:'Pressure washer',kind:'pressure-washer',model:'Honda',
  status:'needs-service',unit:'hours',reading:80,nextServiceReading:100,
  nextServiceDate:null,notes:'PRIVATE REPAIR CODE',createdAt:old,
};
function make(){
  const portfolio=savePortfolioProject(emptyCommercialPortfolio(org),org,'project-1',{
    name:'Private hospital project',input:estimate,
    review:[false,false,false,false,false],phase:'founder-review',
    bookingId:booking,plannedAssetIds:[sourceAsset.id],
    fieldCrewPlan:{crewSize:1,productiveHoursPerPersonDay:4,plannedFieldDays:1,stagingNote:'PRIVATE STAGING NOTE'},
  },null,old);
  const fleet=emptyFleet(org);fleet.assets=[sourceAsset];
  const cards=[
    work('task1','Local portfolio project ID: project-1'),
    work('task-other','Local portfolio project ID: project-1',other),
    work('fuzzy','Project-1 mention only'),
  ];
  const activity:Activity[]=[
    {id:'a1',card_id:'task1',actor:'PRIVATE MEMBER UUID',action:'card_updated',created_at:old},
    {id:'a2',card_id:'task-other',actor:'PRIVATE OTHER MEMBER',action:'card_created',created_at:old},
  ];
  return {org,portfolio,fleet,jobs:[sourceJob],jobState:'ready' as const,cards,activity,today};
}

test('corporate NEXUS overlays real shared task events and exact ID local project source only',()=>{
  const result=buildCorporateNexusOverlay(make());
  assert.equal(result.projects.length,1);
  assert.equal(result.activeLocalProjects,1);
  assert.equal(result.projectsNeedingReview,1);
  assert.equal(result.sourceMatchedProjects,1);
  assert.equal(result.crewShortfalls,1);
  assert.equal(result.withTaskSnapshot,1);
  assert.equal(result.hasLocalFleet,true);
  assert.equal(result.projects[0].bookingState,'loaded');
  assert.equal(result.projects[0].sourceDate,'2026-11-06');
  assert.equal(result.projects[0].crewState,'shortfall');
  assert.deepEqual(result.projects[0].linkedTaskIds,['task1']);
  assert.equal(result.projects[0].candidateAssets,1);
  assert.deepEqual(result.taskActivity.map(a=>a.id),['a1']);
  assert.equal(result.taskActivity[0].title,'Review field needs');
  assert.equal(result.taskActivity[0].venture,'exterior');
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE ADDRESS|PRIVATE REPAIR CODE|PRIVATE STAGING NOTE|PRIVATE MEMBER UUID|39000/);
});

test('failed or loading booking service cannot make projects look source-booked',()=>{
  for(const jobState of ['failed','loading'] as const){
    const i={...make(),jobState};
    const result=buildCorporateNexusOverlay(i);
    assert.equal(result.sourceMatchedProjects,0);
    assert.equal(result.projects[0].sourceDate,null);
    assert.equal(result.projects[0].bookingState,jobState);
    assert.match(result.sourceNote,jobState==='failed'?/unavailable/:/loading/);
  }
});

test('missing booking is an unverified source, not proof of a nonexistent booking',()=>{
  const result=buildCorporateNexusOverlay({...make(),jobs:[]});
  assert.equal(result.projects[0].bookingState,'not-loaded');
  assert.equal(result.sourceMatchedProjects,0);
  assert.match(result.sourceNote,/Coverage may be partial/);
});

test('cancelled booking suppresses scheduled day even if it matches an exact ID',()=>{
  const i=make();
  i.jobs=[{...sourceJob,status:'cancelled'}];
  const result=buildCorporateNexusOverlay(i);
  assert.equal(result.projects[0].bookingState,'inactive');
  assert.equal(result.projects[0].sourceDate,null);
  assert.ok(result.projects[0].attention.some(s=>s.includes('inactive')));
});

test('active NEXUS risk counts exclude archived projects',()=>{
  const i=make();
  i.portfolio=savePortfolioProject(i.portfolio,org,'archive',{
    name:'Archived plan',input:estimate,review:[false,false,false,false,false],
    phase:'archived',bookingId:null,plannedAssetIds:[],
    fieldCrewPlan:{crewSize:1,productiveHoursPerPersonDay:2,plannedFieldDays:1,stagingNote:''},
  },null,'2026-10-22T10:00:00.000Z');
  const result=buildCorporateNexusOverlay(i);
  assert.equal(result.activeLocalProjects,1);
  assert.equal(result.projectsNeedingReview,1);
  assert.equal(result.projects.length,2);
});

test('source org isolation fails closed and does not output other company tasks',()=>{
  const i=make();
  assert.throws(()=>buildCorporateNexusOverlay({...i,org:other}),/another organization/);
  const result=buildCorporateNexusOverlay(i);
  assert.deepEqual(result.taskActivity.map(a=>a.cardId),['task1']);
  assert.equal(result.projects[0].linkedTaskIds.includes('task-other'),false);
});

test('no Fleet source does not invent equipment service clearance or synced assignments',()=>{
  const result=buildCorporateNexusOverlay({...make(),fleet:null});
  assert.equal(result.hasLocalFleet,false);
  assert.equal(result.projects[0].candidateAssets,1);
  assert.equal(result.projects[0].attention.some(x=>x.includes('Equipment marked due')),false);
});

test('no local portfolio entries is not evidence of no business activities',()=>{
  const i=make();
  i.portfolio=emptyCommercialPortfolio(org);
  const result=buildCorporateNexusOverlay(i);
  assert.equal(result.activeLocalProjects,0);
  assert.equal(result.projects.length,0);
  assert.equal(result.taskActivity.length,1); // shared task activity exists separately
});
