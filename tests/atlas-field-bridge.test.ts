import assert from 'node:assert/strict';
import test from 'node:test';
import { newEstimate } from '../src/lib/commercial-estimate';
import { exportCommercialEstimate } from '../src/lib/commercial-transfer';
import { emptyFleet, encodeFleet, readinessItems, type FleetAsset } from '../src/lib/fleet-command';
import {
  chicagoDateOf, fieldBridgeReport, internalFieldBrief, parseLocalCommercialDraft, parseLocalFleetDraft,
} from '../src/lib/atlas-field-bridge';

const org = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const estimate = newEstimate();
estimate.sites = [
  { id:'site-1',name:'A',location:'',levels:3,panes:150,crewHours:18,liftDays:0,access:'lift',notes:'' },
  { id:'site-2',name:'B',location:'',levels:1,panes:70,crewHours:8,liftDays:0,access:'review',notes:'' },
];
const local = JSON.stringify({name:'Commercial test job',input:estimate,review:[true,false,false,false,false]});

test('local commercial parsing preserves intended fields and enforces transfer validation', () => {
  const value = parseLocalCommercialDraft(local, org);
  assert.equal(value.name, 'Commercial test job');
  assert.equal(value.input.sites.length, 2);
  assert.deepEqual(value.review, [true,false,false,false,false]);
  assert.throws(() => parseLocalCommercialDraft('{bad', org), /JSON/);
  assert.throws(() => parseLocalCommercialDraft(JSON.stringify({name:'bad',input:{sites:[]},review:[false,false,false,false,false]}), org), /between 1 and 12/);
  assert.throws(() => parseLocalCommercialDraft(JSON.stringify({...JSON.parse(local),organization_id:other}), org), /another organization/);
  assert.throws(() => parseLocalCommercialDraft('x'.repeat(270000), org), /too large/);
  assert.throws(() => parseLocalCommercialDraft(JSON.stringify({...JSON.parse(local), input:{...estimate,laborRate:Infinity}}), org), /Hourly labor rate/);
});

test('fleet cross-organization and corrupt drafts are rejected before projection', () => {
  const data = emptyFleet(org);
  assert.deepEqual(parseLocalFleetDraft(encodeFleet(data,org), org), data);
  assert.throws(() => parseLocalFleetDraft(encodeFleet(data,org), other), /another company/);
  assert.throws(() => parseLocalFleetDraft('not json', org), /valid Fleet Command JSON/);
});

test('read-only bridge distinguishes missing data rather than inventing a ready fleet', () => {
  const report = fieldBridgeReport(null,null,'2026-10-22');
  assert.equal(report.commercial,null);
  assert.equal(report.fleet,null);
  assert.deepEqual(report.findings.map(x=>x.id),['no-project','no-fleet']);
  assert.match(internalFieldBrief(report,'2026-10-22'),/unknown/);
});

test('commercial site survey, rental scope and checklist gaps are surfaced without pretending approval', () => {
  const report = fieldBridgeReport(parseLocalCommercialDraft(local, org), null, '2026-10-22');
  assert.equal(report.commercial?.buildings,2);
  assert.equal(report.commercial?.crewHours,26);
  assert.equal(report.commercial?.rentalScopeMissing,1);
  assert.equal(report.commercial?.accessToSurvey,1);
  assert.deepEqual(report.findings.map(x=>x.id),['site-access','rental-days','bid-review','no-fleet']);
});

test('fleet warnings are grounded in asset condition, dated checks, and entered payload only', () => {
  const workbook = emptyFleet(org);
  const asset: FleetAsset = {
    id:'asset-1',name:'Recorded washer',kind:'pressure-washer',model:'Test',
    status:'needs-service',unit:'hours',reading:40,nextServiceReading:null,
    nextServiceDate:null,notes:'',createdAt:'2026-10-22T10:00:00.000Z',
  };
  workbook.assets=[asset];
  workbook.readiness={checked:readinessItems.map(x=>x.id),updatedAt:'2026-10-21T21:00:00.000Z'};
  workbook.rig={vehiclePayloadLb:200,emptyRigLb:400,waterGallons:0,otherCargoLb:0,peopleLb:0};
  const report = fieldBridgeReport(parseLocalCommercialDraft(local,org),workbook,'2026-10-22');
  assert.equal(report.fleet?.attention,1);
  assert.equal(report.fleet?.checklistFresh,false);
  assert.equal(report.fleet?.checklistChecked,0);
  assert.equal(report.fleet?.enteredPayloadExceeded,true);
  assert.deepEqual(report.findings.filter(x=>x.severity==='attention').map(x=>x.id),
    ['site-access','rental-days','service','old-checklist','payload']);
  assert.match(internalFieldBrief(report,'2026-10-22'),/not synchronized with the other founder/i);
  assert.doesNotMatch(internalFieldBrief(report,'2026-10-22'),/approved proposal/i);
});

test('unverified equipment and omitted vehicle payload remain unknown even with current checklist', () => {
  const workbook = emptyFleet(org);
  workbook.readiness={checked:readinessItems.map(x=>x.id),updatedAt:'2026-10-22T05:00:00.000Z'};
  const report=fieldBridgeReport(null,workbook,'2026-10-22');
  assert.equal(report.fleet?.checklistChecked,readinessItems.length);
  assert.equal(report.fleet?.payloadRemainingLb,null);
  assert.equal(report.findings.some(x=>x.id==='capacity-unknown'),true);
  assert.equal(report.findings.some(x=>x.id==='no-assets'),true);
});

test('portable validated commercial transfer and legacy local draft share accepted contract', () => {
  const localSnapshot = JSON.parse(local) as {name:string;input:typeof estimate;review:boolean[]};
  const portable = exportCommercialEstimate(org,localSnapshot.name,localSnapshot.input,localSnapshot.review);
  const transfer = JSON.parse(portable);
  const value = parseLocalCommercialDraft(JSON.stringify(transfer),org);
  assert.equal(value.input.sites[0].id,'site-1');
});

test('departure day uses Chicago calendar date, not UTC date', () => {
  assert.equal(chicagoDateOf('2026-10-23T02:30:00.000Z'),'2026-10-22');
  assert.equal(chicagoDateOf('2026-10-22T04:59:59.000Z'),'2026-10-21');
  assert.equal(chicagoDateOf(null),null);
  const workbook=emptyFleet(org);
  workbook.readiness={checked:readinessItems.map(x=>x.id),updatedAt:'2026-10-23T02:30:00.000Z'};
  const report=fieldBridgeReport(null,workbook,'2026-10-22');
  assert.equal(report.fleet?.checklistFresh,true);
  assert.equal(report.findings.some(x=>x.id==='old-checklist'),false);
});
