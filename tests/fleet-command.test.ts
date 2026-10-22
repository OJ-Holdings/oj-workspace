import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assetHealth, calculateRigLoad, decodeFleet, emptyFleet, encodeFleet,
  readinessItems, validDay, validateFleet, type FleetAsset, type FleetMaintenance,
} from '../src/lib/fleet-command';

const org='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const makeAsset=(overrides: Partial<FleetAsset>={}): FleetAsset => ({
  id:'asset-1',name:'Demo pressure washer',kind:'pressure-washer',model:'GX390 / CAT',
  status:'ready',unit:'hours',reading:82,nextServiceReading:100,
  nextServiceDate:'2026-11-20',notes:'Inspection pending',
  createdAt:'2026-10-22T13:00:00.000Z',...overrides,
});
const makeService=(): FleetMaintenance=>({
  id:'service-1',assetId:'asset-1',date:'2026-10-20',
  summary:'Replaced worn injector O-ring',cost:22.5,reading:80,
});
const sample=()=>{
  const data=emptyFleet(org);
  data.assets=[makeAsset()];
  data.maintenance=[makeService()];
  data.readiness={checked:['engine','hose'],updatedAt:'2026-10-22T13:00:00.000Z'};
  data.rig={vehiclePayloadLb:1300,emptyRigLb:475,waterGallons:40,otherCargoLb:130,peopleLb:165};
  return data;
};

test('Fleet Command starts with no invented real-world assets or maintenance',()=>{
  const data=emptyFleet(org);
  assert.equal(data.assets.length,0);
  assert.equal(data.maintenance.length,0);
  assert.equal(data.readiness.checked.length,0);
  assert.equal(data.rig.vehiclePayloadLb,null);
});

test('private fleet workbook round trips without losing equipment, service or readiness data',()=>{
  const data=sample();
  const encoded=encodeFleet(data,org);
  assert.deepEqual(decodeFleet(encoded,org),data);
  assert.deepEqual(validateFleet(data,org),data);
});

test('Fleet Command files cannot be imported across company organizations',()=>{
  assert.throws(()=>decodeFleet(encodeFleet(sample(),org),other),/another company/i);
});

test('fleet import rejects unknown versions, malformed and oversized data',()=>{
  const file=encodeFleet(sample(),org);
  assert.throws(()=>decodeFleet('not-json',org),/valid Fleet Command JSON/);
  assert.throws(()=>decodeFleet(file.replace('oj-fleet-local-v1','wrong-format'),org),/Unsupported/);
  assert.throws(()=>decodeFleet(JSON.stringify({...sample(),version:2}),org),/Unsupported/);
  assert.throws(()=>decodeFleet('x'.repeat(256*1024+1),org),/256 KB/);
  assert.throws(()=>decodeFleet('',org),/empty/i);
});

test('strictly whitelisted records cannot smuggle unexpected fields',()=>{
  const data=sample() as unknown as Record<string,unknown>;
  data.untrusted='unexpected payload';
  (data.assets as Record<string,unknown>[])[0].unexpected=true;
  const cleaned=validateFleet(data,org) as unknown as Record<string,unknown>;
  assert.equal('untrusted' in cleaned,false);
  assert.equal('unexpected' in (cleaned.assets as Record<string,unknown>[])[0],false);
});

test('service records must reference existing equipment and have unique identifiers',()=>{
  const data=sample();
  data.maintenance[0].assetId='not-here';
  assert.throws(()=>validateFleet(data,org),/unknown asset/);
  const dup=sample();
  dup.assets.push({...dup.assets[0]});
  assert.throws(()=>validateFleet(dup,org),/Duplicate fleet asset/);
  const svc=sample();
  svc.maintenance.push({...svc.maintenance[0]});
  assert.throws(()=>validateFleet(svc,org),/Duplicate maintenance/);
});

test('reject invalid notes, negative service costs, nonfinite inputs and unsupported statuses',()=>{
  const a=sample();
  a.assets[0].status='fake' as FleetAsset['status'];
  assert.throws(()=>validateFleet(a,org),/asset status/);
  const b=sample();
  b.assets[0].notes='x'.repeat(2001);
  assert.throws(()=>validateFleet(b,org),/Asset notes/);
  const c=sample();
  c.maintenance[0].cost=-10;
  assert.throws(()=>validateFleet(c,org),/Service cost/);
  const d=sample();
  d.assets[0].reading=Number.NaN;
  assert.throws(()=>validateFleet(d,org),/meter reading/);
  const e=sample();
  e.assets[0].unit='none';
  assert.throws(()=>validateFleet(e,org),/Meter values require/);
});

test('invalid calendar dates are never treated as valid service deadlines',()=>{
  assert.equal(validDay('2026-10-22'),true);
  assert.equal(validDay('2026-02-30'),false);
  assert.equal(validDay('2026-13-01'),false);
  assert.equal(validDay('2026/10/22'),false);
  const data=sample();
  data.assets[0].nextServiceDate='2026-02-30';
  assert.throws(()=>validateFleet(data,org),/Invalid service date/);
});

test('fleet maintenance alerts derive from entered thresholds, not guessed intervals',()=>{
  const today='2026-10-22';
  assert.equal(assetHealth(makeAsset({status:'unverified'}),today),'monitor');
  assert.equal(assetHealth(makeAsset({status:'out-of-service'}),today),'out-of-service');
  assert.equal(assetHealth(makeAsset({status:'needs-service'}),today),'needs-service');
  assert.equal(assetHealth(makeAsset({reading:100}),today),'due');
  assert.equal(assetHealth(makeAsset({nextServiceDate:'2026-10-21'}),today),'due');
  assert.equal(assetHealth(makeAsset({nextServiceDate:'2026-10-30'}),today),'due-soon');
  assert.equal(assetHealth(makeAsset({reading:96}),today),'due-soon');
  assert.equal(assetHealth(makeAsset({nextServiceDate:'2026-11-30',reading:20}),today),'ready');
  assert.equal(assetHealth(makeAsset({nextServiceDate:null,nextServiceReading:null}),today),'monitor');
});

test('rig calculator includes water, people, cargo, and honours unknown capacity',()=>{
  const plan=sample().rig;
  const result=calculateRigLoad(plan);
  assert.equal(result.waterLb,333.6);
  assert.equal(result.totalLb,1103.6);
  assert.equal(result.remainingLb,196.4);
  assert.equal(result.exceedsEnteredPayload,false);
  const unknown=calculateRigLoad({...plan,vehiclePayloadLb:null});
  assert.equal(unknown.remainingLb,null);
  assert.equal(unknown.hasVehicleCapacity,false);
  const tooHeavy=calculateRigLoad({...plan,vehiclePayloadLb:1000});
  assert.equal(tooHeavy.remainingLb,-103.6);
  assert.equal(tooHeavy.exceedsEnteredPayload,true);
});

test('readiness checklist permits only known unique items',()=>{
  assert.equal(readinessItems.length,10);
  const data=sample();
  data.readiness.checked=['not-valid' as 'engine'];
  assert.throws(()=>validateFleet(data,org),/Invalid readiness/);
  const dup=sample();
  dup.readiness.checked=['engine','engine'];
  assert.throws(()=>validateFleet(dup,org),/Invalid readiness/);
});
