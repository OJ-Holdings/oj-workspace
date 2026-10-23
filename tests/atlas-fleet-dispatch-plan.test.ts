import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyCommercialPortfolio, savePortfolioProject } from '../src/lib/atlas-commercial-portfolio';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyFleet, type FleetAsset } from '../src/lib/fleet-command';
import { buildFleetDispatchProjection, calendarHorizon, dispatchRowsInHorizon } from '../src/lib/atlas-fleet-dispatch-plan';
import type { JobItem } from '../src/app/workspace/exterior-actions';
import type { Card } from '../src/lib/board';

const org='00000000-0000-4000-8000-000000000001';
const time='2026-10-22T17:00:00.000Z';
const booking1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const booking2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const project=(id:string,bookingId:string|null,assetIds:string[]=['asset-1'],phase:'scoping'|'founder-review'|'archived'='scoping')=>({
  id,bookingId,assetIds,phase,
});
function portfolio(){
  let p=emptyCommercialPortfolio(org);
  for(const [idx,spec] of [
    project('proj1',booking1),
    project('proj2',booking2),
    project('proj3',null),
    project('archived',null,[],'archived'),
  ].entries()){
    const input=newEstimate();input.sites[0].crewHours=idx+8;
    p=savePortfolioProject(p,org,spec.id,{
      name:'Complex '+idx,input,review:[false,false,false,false,false],
      phase:spec.phase,bookingId:spec.bookingId,plannedAssetIds:spec.assetIds,
    },null,time);
  }
  return p;
}
const jobs:JobItem[]=[
  {id:booking1,lead_id:'lead1',date:'2026-10-25',time_block:'9 to 12',
    status:'confirmed',name:'PRIVATE NAME A',service:'Commercial windows',
    address:'PRIVATE STREET A',quote:10000},
  {id:booking2,lead_id:'lead2',date:'2026-10-25',time_block:'12 to 3',
    status:'confirmed',name:'PRIVATE NAME B',service:'Commercial windows',
    address:'PRIVATE STREET B',quote:20000},
];
const fleet=()=>{
  const f=emptyFleet(org);
  const asset:FleetAsset={
    id:'asset-1',name:'Local washer',kind:'pressure-washer',model:'GX390',
    status:'needs-service',unit:'hours',reading:30,nextServiceReading:40,
    nextServiceDate:null,notes:'',createdAt:time,
  };
  f.assets=[asset];return f;
};
const task=(id:string,orgId=org,description='Local portfolio project ID: proj1'):Card=>({
  id,organization_id:orgId,title:'Review actual scope',business:'exterior',stage:'Review',
  description,priority:'normal',assignee:'',due_date:'',revision:0,checklist:[],
});

test('source-backed projection distinguishes loaded bookings from unscheduled local plans',()=>{
  const snapshot=buildFleetDispatchProjection(portfolio(),fleet(),jobs,'ready',[task('task1'),task('task2',org,'Project proj2 mentioned')],org,'2026-10-22');
  assert.equal(snapshot.rows.length,3);
  assert.equal(snapshot.sourcedRows,2);
  assert.equal(snapshot.unscheduledRows,1);
  assert.equal(snapshot.loadedBookings,2);
  assert.equal(snapshot.assetIssueRows,3);
  assert.equal(snapshot.collisionRows,2);
  assert.equal(snapshot.linkedTaskCount,1);
  assert.deepEqual(snapshot.rows.filter(x=>x.bookingDate).map(x=>x.bookingDate),['2026-10-25','2026-10-25']);
  assert.equal(snapshot.rows[0].plannedAssets[0].state,'needs-service');
  assert.equal(snapshot.rows[0].crewHours,8);
  assert.equal(snapshot.rows[0].linkedTasks[0].id,'task1');
  assert.deepEqual(snapshot.rows[0].sameDayOverlapIds,['asset-1']);
  assert.doesNotMatch(JSON.stringify(snapshot),/PRIVATE NAME|PRIVATE STREET|10000|20000/);
});

test('failed or pending source fetch never creates dates, verified bookings or false collisions',()=>{
  for(const state of ['loading','failed'] as const){
    const report=buildFleetDispatchProjection(portfolio(),fleet(),jobs,state,[],org,'2026-10-22');
    assert.equal(report.loadedBookings,0);
    assert.equal(report.sourcedRows,0);
    assert.equal(report.collisionRows,0);
    assert.equal(report.rows.every(x=>x.bookingDate===null),true);
    assert.equal(report.rows.filter(x=>x.bookingId!==null).every(x=>x.bookingState===(state==='failed'?'source-failed':'source-pending')),true);
  }
});
test('foreign or fuzzy task references do not become project relations',()=>{
  const report=buildFleetDispatchProjection(portfolio(),fleet(),jobs,'ready',[
    task('foreign','00000000-0000-4000-8000-000000000002'),
    task('fuzzy',org,'Mention: proj1'),
    task('exact',org,'Local portfolio project ID: proj2'),
  ],org,'2026-10-22');
  assert.equal(report.linkedTaskCount,1);
  assert.equal(report.rows.find(x=>x.projectId==='proj2')?.linkedTasks[0]?.id,'exact');
});

test('cancelled booking remains inactive and never drives source-linked dispatch',()=>{
  const cancelled=[{...jobs[0],status:'cancelled'},jobs[1]];
  const report=buildFleetDispatchProjection(portfolio(),fleet(),cancelled,'ready',[],org,'2026-10-22');
  assert.equal(report.sourcedRows,1);
  assert.equal(report.rows.find(x=>x.projectId==='proj1')?.bookingState,'inactive');
  assert.equal(report.rows.find(x=>x.projectId==='proj1')?.bookingDate,null);
  assert.equal(report.collisionRows,0);
});
test('different booking dates are not treated as same-day planned asset conflicts',()=>{
  const moved=[jobs[0],{...jobs[1],date:'2026-10-26'}];
  const report=buildFleetDispatchProjection(portfolio(),fleet(),moved,'ready',[],org,'2026-10-22');
  assert.equal(report.collisionRows,0);
});

test('horizon grouping uses calendar boundaries and preserves unknown records',()=>{
  assert.deepEqual(calendarHorizon('2026-10-22',7),{start:'2026-10-22',end:'2026-10-28'});
  assert.deepEqual(calendarHorizon('2026-12-25',30),{start:'2026-12-25',end:'2027-01-23'});
  assert.equal(calendarHorizon('not a day',30),null);
  const projection=buildFleetDispatchProjection(portfolio(),fleet(),jobs,'ready',[],org,'2026-10-22');
  const week=dispatchRowsInHorizon(projection.rows,'2026-10-22',7);
  assert.equal(week.scheduled.length,2);
  assert.equal(week.unverified.length,1);
  assert.equal(week.outside.length,0);
  const early=dispatchRowsInHorizon(projection.rows,'2026-10-26',7);
  assert.equal(early.outside.length,2);
  assert.equal(early.unverified.length,1);
});
