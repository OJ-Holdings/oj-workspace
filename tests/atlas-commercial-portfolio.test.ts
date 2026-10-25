import assert from 'node:assert/strict';
import test from 'node:test';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyFleet, type FleetAsset } from '../src/lib/fleet-command';
import type { ExtBooking } from '../src/lib/exterior';
import {
  decodeCommercialPortfolio, deletePortfolioProject, emptyCommercialPortfolio,
  encodeCommercialPortfolio, projectEquipmentEvidence, resolveSourceBooking,
  resourcePlanFindings, savePortfolioProject, type CommercialPortfolio, type ProjectDraft,
} from '../src/lib/atlas-commercial-portfolio';

const org='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const time='2026-10-22T16:00:00.000Z';
const id1='11111111111144448888111111111111';
const id2='22222222222244448888222222222222';
const booking1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const booking2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const draft=(overrides:Partial<ProjectDraft>={}):ProjectDraft=>({
  name:'Commercial property A',input:newEstimate(),
  review:[false,false,false,false,false],phase:'scoping',bookingId:null,plannedAssetIds:[],
  ...overrides,
});
const saved=(id=id1,overrides:Partial<ProjectDraft>={})=>
  savePortfolioProject(emptyCommercialPortfolio(org),org,id,draft(overrides),null,time);
const bookings:ExtBooking[]=[
  {id:booking1,lead_id:null,date:'2026-11-12',time_block:'9 to 12',status:'confirmed'},
  {id:booking2,lead_id:null,date:'2026-11-12',time_block:'12 to 3',status:'confirmed'},
];
const asset=(overrides:Partial<FleetAsset>={}):FleetAsset=>({
  id:'asset-1',name:'4 GPM field washer',kind:'pressure-washer',model:'GX390',
  status:'ready',unit:'hours',reading:70,nextServiceReading:100,
  nextServiceDate:'2026-11-20',notes:'',createdAt:time,...overrides,
});

test('project registry starts empty without inventing real bids or customer links',()=>{
  const data=emptyCommercialPortfolio(org);
  assert.equal(data.projects.length,0);
  assert.equal(data.revision,0);
  assert.deepEqual(decodeCommercialPortfolio(encodeCommercialPortfolio(data,org),org),data);
});

test('save and reopen multiple projects with distinct versioned estimates and statuses',()=>{
  let p=saved();
  const alternative=newEstimate();alternative.sites[0].crewHours=44;alternative.margin=36;
  p=savePortfolioProject(p,org,id2,draft({
    name:'Property B',input:alternative,phase:'founder-review',
    bookingId:booking1,plannedAssetIds:['asset-1'],
  }),null,'2026-10-22T17:00:00.000Z');
  assert.equal(p.revision,2);
  assert.deepEqual(p.projects.map(x=>x.name),['Commercial property A','Property B']);
  assert.equal(p.projects[1].input.sites[0].crewHours,44);
  assert.equal(p.projects[1].bookingId,booking1);
  assert.equal(p.projects[1].revision,1);
  assert.deepEqual(decodeCommercialPortfolio(encodeCommercialPortfolio(p,org),org),p);
  const update=savePortfolioProject(p,org,id2,draft({
    name:'Revised property B',input:alternative,phase:'founder-review',bookingId:booking1,
    plannedAssetIds:['asset-1'],
  }),1,'2026-10-22T17:30:00.000Z');
  assert.equal(update.projects[1].revision,2);
  assert.equal(p.projects[1].name,'Property B');
  assert.deepEqual(update.projects[0],p.projects[0]);
});

test('stale write, stale delete and duplicate assignment IDs fail closed',()=>{
  const p=saved();
  assert.throws(()=>savePortfolioProject(p,org,id1,draft(),0,time),/changed/);
  assert.throws(()=>savePortfolioProject(p,org,id2,draft(),1,time),/no longer exists/);
  assert.throws(()=>deletePortfolioProject(p,org,id1,0),/changed/);
  assert.throws(()=>savePortfolioProject(p,org,id2,draft({plannedAssetIds:['asset-1','asset-1']}),null,time),/Duplicate planned/);
  const removed=deletePortfolioProject(p,org,id1,1);
  assert.equal(removed.projects.length,0);
  assert.equal(p.projects.length,1);
});

test('malformed, oversized, cross-organization, duplicate projects and invalid prices are rejected',()=>{
  const p=saved();
  assert.throws(()=>decodeCommercialPortfolio('{bad',org),/valid JSON/);
  assert.throws(()=>decodeCommercialPortfolio(encodeCommercialPortfolio(p,org),other),/another workspace/);
  assert.throws(()=>decodeCommercialPortfolio('X'.repeat(5300000),org),/exceeds 5 MB/);
  assert.throws(()=>decodeCommercialPortfolio(JSON.stringify({...p,version:2}),org),/Unsupported/);
  assert.throws(()=>decodeCommercialPortfolio(JSON.stringify({...p,projects:[p.projects[0],p.projects[0]]}),org),/Duplicate project IDs/);
  assert.throws(()=>savePortfolioProject(p,org,id2,draft({bookingId:'not-a-source-id'}),null,time),/UUID/);
  const broken=newEstimate();broken.laborRate=-20;
  assert.throws(()=>savePortfolioProject(p,org,id2,draft({input:broken}),null,time),/Hourly labor rate/);
});

test('browser recovery project limit cannot be bypassed',()=>{
  let p=emptyCommercialPortfolio(org);
  for(let i=0;i<250;i++){
    p=savePortfolioProject(p,org,'p'+i,draft({name:'Property '+i}),null,time);
  }
  assert.equal(p.projects.length,250);
  assert.throws(()=>savePortfolioProject(p,org,'overflow',draft(),null,time),/250 projects/);
});

test('booking references resolve only exact IDs among actually loaded source bookings',()=>{
  assert.equal(resolveSourceBooking(booking1,bookings).state,'loaded-active');
  assert.equal(resolveSourceBooking(null,bookings).state,'unlinked');
  assert.equal(resolveSourceBooking('cccccccc-cccc-4ccc-8ccc-cccccccccccc',bookings).state,'not-loaded');
  const cancelled=bookings.map(b=>b.id===booking1?{...b,status:'cancelled'}:b);
  assert.equal(resolveSourceBooking(booking1,cancelled).state,'loaded-inactive');
  assert.equal(resolveSourceBooking(booking2,cancelled).state,'loaded-active');
});

test('fleet equipment plan does not imply actual availability or reservation',()=>{
  const p=saved(id1,{bookingId:booking1,plannedAssetIds:['asset-1','asset-gone']}).projects[0];
  const fleet=emptyFleet(org);fleet.assets=[asset({status:'needs-service'})];
  const evidence=projectEquipmentEvidence(p,fleet,'2026-10-22');
  assert.deepEqual(evidence.map(x=>x.state),['needs-service','missing']);
  const findings=resourcePlanFindings(p,[p],fleet,bookings,'2026-10-22');
  assert.equal(findings.some(x=>x.id==='asset-asset-1'&&x.severity==='attention'),true);
  assert.equal(findings.some(x=>x.id==='asset-asset-gone'&&x.severity==='unknown'),true);
  assert.equal(findings.some(x=>x.id==='booking-unloaded'),false);
});

test('same-date different-booking planned asset overlap triggers review only, never an actual booking conflict assertion',()=>{
  let p=saved(id1,{bookingId:booking1,plannedAssetIds:['asset-1']});
  p=savePortfolioProject(p,org,id2,draft({
    name:'Other campus',bookingId:booking2,plannedAssetIds:['asset-1'],
  }),null,time);
  const fleet=emptyFleet(org);fleet.assets=[asset()];
  const findings=resourcePlanFindings(p.projects[0],p.projects,fleet,bookings,'2026-10-22');
  assert.equal(findings.some(x=>x.id==='asset-conflict-'+id2&&x.severity==='review'),true);
  const archived={...p.projects[1],phase:'archived' as const};
  assert.equal(resourcePlanFindings(p.projects[0],[p.projects[0],archived],fleet,bookings,'2026-10-22').some(x=>x.id.startsWith('asset-conflict')),false);
  const rescheduled=[bookings[0],{...bookings[1],date:'2026-11-13'}];
  assert.equal(resourcePlanFindings(p.projects[0],p.projects,fleet,rescheduled,'2026-10-22').some(x=>x.id.startsWith('asset-conflict')),false);
});

test('future safety changes do not backfill actual dispatch or payment semantics',()=>{
  const p=saved(id1,{phase:'founder-review',bookingId:booking1,plannedAssetIds:['asset-1']}).projects[0];
  assert.equal(p.phase,'founder-review');
  assert.equal(Object.hasOwn(p,'approved'),false);
  assert.equal(Object.hasOwn(p,'paid'),false);
  assert.equal(Object.hasOwn(p,'dispatched'),false);
});
