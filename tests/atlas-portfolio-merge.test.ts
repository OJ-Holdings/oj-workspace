import assert from 'node:assert/strict';
import test from 'node:test';
import { newEstimate } from '../src/lib/commercial-estimate';
import {
  decodeCommercialPortfolio, emptyCommercialPortfolio, encodeCommercialPortfolio,
  savePortfolioProject, type CommercialPortfolio, type ProjectDraft,
} from '../src/lib/atlas-commercial-portfolio';
import { mergeNonConflictingPortfolio, previewPortfolioMerge } from '../src/lib/atlas-portfolio-merge';

const org='00000000-0000-4000-8000-000000000001';
const alien='00000000-0000-4000-8000-000000000002';
const clock='2026-10-23T05:00:00.000Z';
const draft=(name:string):ProjectDraft=>({
  name,input:newEstimate(),review:[false,false,false,false,false],
  phase:'scoping',bookingId:null,plannedAssetIds:[],
  fieldCrewPlan:{crewSize:null,productiveHoursPerPersonDay:null,plannedFieldDays:null,stagingNote:'PRIVATE NOTE'},
});
const write=(p:CommercialPortfolio,id:string,name:string,at=clock)=>savePortfolioProject(p,org,id,draft(name),null,at);
const stored=(id='a',name='Project A')=>write(emptyCommercialPortfolio(org),id,name);

test('merge preview is pure and returns exact IDs, not name or address correlations',()=>{
  const local=stored('alpha','Same project name');
  const imported=stored('bravo','Same project name');
  const localBefore=encodeCommercialPortfolio(local,org);
  const fileBefore=encodeCommercialPortfolio(imported,org);
  const plan=previewPortfolioMerge(local,imported,org);
  assert.deepEqual(plan.additions.map(p=>p.id),['bravo']);
  assert.equal(plan.identicalIds.length,0);
  assert.equal(plan.conflicts.length,0);
  assert.equal(plan.projectedCount,2);
  assert.deepEqual(plan.existingCount,1);
  assert.equal(encodeCommercialPortfolio(local,org),localBefore);
  assert.equal(encodeCommercialPortfolio(imported,org),fileBefore);
});

test('nonconflicting merge preserves every existing project byte-for-byte and imports only new identifiers',()=>{
  const local=write(stored('a','This device A'),'c','This device C');
  const incoming=write(stored('a','This device A'),'b','Other device B');
  const result=mergeNonConflictingPortfolio(local,incoming,org);
  assert.equal(result.changed,true);
  assert.equal(result.next.revision,local.revision+1);
  assert.deepEqual(result.next.projects.map(p=>p.id),['a','c','b']);
  assert.deepEqual(result.next.projects[0],local.projects[0]);
  assert.deepEqual(result.next.projects[1],local.projects[1]);
  assert.deepEqual(result.next.projects[2],incoming.projects[1]);
  assert.deepEqual(result.plan.identicalIds,['a']);
  assert.deepEqual(result.plan.additions.map(p=>p.id),['b']);
  assert.equal(result.plan.conflicts.length,0);
  const reopened=decodeCommercialPortfolio(encodeCommercialPortfolio(result.next,org),org);
  assert.deepEqual(reopened,result.next);
});

test('same exact ID with modified scope conflicts even if revision numbers and names are the same',()=>{
  const local=stored('alpha','Our job');
  const imported=stored('alpha','Our job');
  imported.projects[0].input.sites[0].panes=400;
  const plan=previewPortfolioMerge(local,imported,org);
  assert.equal(plan.additions.length,0);
  assert.equal(plan.identicalIds.length,0);
  assert.deepEqual(plan.conflicts.map(c=>c.id),['alpha']);
  assert.equal(plan.conflicts[0].existingRevision,plan.conflicts[0].incomingRevision);
  const result=mergeNonConflictingPortfolio(local,imported,org);
  assert.equal(result.changed,false);
  assert.deepEqual(result.next,local);
  assert.equal(result.plan.conflicts.length,1);
});

test('higher imported revision never overwrites local due to unsynchronized edit clocks',()=>{
  const local=stored('alpha','Local version');
  let imported=stored('alpha','Incoming version');
  imported=savePortfolioProject(imported,org,'alpha',draft('Later on a different device'),
    1,'2026-10-23T07:00:00.000Z');
  const result=mergeNonConflictingPortfolio(local,imported,org);
  assert.equal(result.changed,false);
  assert.equal(result.next.projects[0].name,'Local version');
  assert.equal(result.plan.conflicts[0].incomingRevision,2);
  assert.equal(result.plan.conflicts[0].existingRevision,1);
});

test('merge can admit other new ID while explicitly skipping a collision',()=>{
  const local=stored('alpha','A local');
  const imported=write(stored('alpha','A changed remotely'),'beta','B new');
  const result=mergeNonConflictingPortfolio(local,imported,org);
  assert.equal(result.changed,true);
  assert.deepEqual(result.next.projects.map(p=>p.id),['alpha','beta']);
  assert.equal(result.next.projects[0].name,'A local');
  assert.equal(result.next.projects[1].name,'B new');
  assert.deepEqual(result.plan.conflicts.map(c=>c.id),['alpha']);
});

test('identical file is a no-op and does not increment local revision',()=>{
  const local=stored();
  const copy=decodeCommercialPortfolio(encodeCommercialPortfolio(local,org),org);
  const result=mergeNonConflictingPortfolio(local,copy,org);
  assert.equal(result.changed,false);
  assert.equal(result.next.revision,local.revision);
  assert.deepEqual(result.next,local);
  assert.deepEqual(result.plan.identicalIds,['a']);
});

test('organization boundary blocks both import preview and merge; no foreign project leaks',()=>{
  const local=stored();
  const foreign=write(emptyCommercialPortfolio(org),'new','Sensitive foreign name');
  foreign.organizationId=alien;
  assert.throws(()=>previewPortfolioMerge(local,foreign,org),/another workspace organization/);
  assert.throws(()=>mergeNonConflictingPortfolio(local,foreign,org),/another workspace organization/);
  assert.deepEqual(local.projects.map(p=>p.id),['a']);
});

test('capacity overflow refuses the entire batch rather than partially importing or overwriting',()=>{
  let local=emptyCommercialPortfolio(org);
  for(let i=0;i<23;i++)local=write(local,'local'+i,'Local project '+i);
  const incoming=write(stored('new1','New 1'),'new2','New 2');
  const plan=previewPortfolioMerge(local,incoming,org);
  assert.equal(plan.capacityAvailable,false);
  assert.equal(plan.projectedCount,25);
  assert.throws(()=>mergeNonConflictingPortfolio(local,incoming,org),/24-project browser limit/);
  assert.equal(local.projects.length,23);
});

test('incoming project validation rejects malformed duplicate IDs and unsupported formats before any merge',()=>{
  const local=stored();
  const incoming=stored('other');
  const invalid={...incoming,projects:[incoming.projects[0],incoming.projects[0]]};
  assert.throws(()=>previewPortfolioMerge(local,invalid,org),/Duplicate project IDs/);
  assert.throws(()=>mergeNonConflictingPortfolio(local,invalid,org),/Duplicate project IDs/);
  assert.throws(()=>previewPortfolioMerge(local,{...incoming,version:2} as unknown as CommercialPortfolio,org),/Unsupported/);
});

test('local original remains untouched when importer cannot insert more projects',()=>{
  let local=emptyCommercialPortfolio(org);
  for(let i=0;i<24;i++)local=write(local,'local'+i,'Local project '+i);
  const before=encodeCommercialPortfolio(local,org);
  assert.throws(()=>mergeNonConflictingPortfolio(local,stored('extra'),org),/browser limit/);
  assert.equal(encodeCommercialPortfolio(local,org),before);
});
