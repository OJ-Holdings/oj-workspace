import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking} from '../src/lib/exterior';
import {
  emptyFleet,encodeFleet,decodeFleet,type FleetAsset,
} from '../src/lib/fleet-command';
import {
  EQUIPMENT_PLAN_FORMAT,equipmentPlanKey,makeEquipmentPlan,
  parseEquipmentPlan,encodeEquipmentPlan,evaluateEquipmentPlan,
  type FieldEquipmentPlan,
} from '../src/lib/exterior-field-equipment';

const org='00000000-0000-4000-8000-000000000001';
const wrongOrg='00000000-0000-4000-8000-000000000002';
const bid='11111111-1111-4111-8111-111111111111';
const leadId='22222222-2222-4222-8222-222222222222';
const b=(patch:Partial<ExtBooking>={}):ExtBooking=>({
 id:bid,lead_id:leadId,date:'2026-10-23',time_block:'9-12',status:'confirmed',...patch,
});
const asset=(patch:Partial<FleetAsset>={}):FleetAsset=>({
 id:'washer1',name:'Simpson washer',kind:'pressure-washer',model:'GX390 CAT',
 status:'ready',unit:'hours',reading:40,nextServiceReading:100,
 nextServiceDate:'2026-12-01',notes:'local equipment',
 createdAt:'2026-10-01T12:00:00.000Z',...patch,
});
const fleet=()=>{
 const f=emptyFleet(org);
 f.assets=[asset(),asset({id:'vehicle1',name:'OJ Explorer',kind:'vehicle',unit:'miles',reading:2000,nextServiceReading:3000})];
 f.readiness={checked:['engine','hose','water','chem','ppe','contain','ladders','traffic','contact','photos'],updatedAt:'2026-10-23T16:00:00.000Z'};
 f.rig={vehiclePayloadLb:1500,emptyRigLb:500,waterGallons:35,peopleLb:320,otherCargoLb:100};
 return f;
};
const plan=():FieldEquipmentPlan=>({
 ...makeEquipmentPlan(org,b()),selectedAssetIds:['washer1'],
 reviewedAt:'2026-10-23T17:00:00.000Z',
});
test('local booking plans start empty and never claim a fleet reservation',()=>{
 const p=makeEquipmentPlan(org,b());
 assert.equal(p.format,EQUIPMENT_PLAN_FORMAT);
 assert.equal(p.bookingId,bid);
 assert.equal(p.leadId,leadId);
 assert.deepEqual(p.selectedAssetIds,[]);
 assert.equal(p.reviewedAt,null);
 assert.ok(equipmentPlanKey(org,bid).includes(bid));
 assert.equal('reserved' in p,false);
 assert.equal('approved' in p,false);
});
test('strict exact-org and exact-booking assignment rejects cross-tenant imports',()=>{
 const raw=encodeEquipmentPlan(plan(),org,b());
 assert.deepEqual(parseEquipmentPlan(raw,org,b()),plan());
 assert.throws(()=>parseEquipmentPlan(raw,wrongOrg,b()),/another company or booking/i);
 assert.throws(()=>parseEquipmentPlan(raw,org,b({id:'other'})),/another company or booking/i);
 assert.throws(()=>parseEquipmentPlan(raw,org,b({lead_id:'other'})),/another company or booking/i);
});
test('bad date, duplicate assets, malformed JSON and forged fields are not trusted',()=>{
 const p=plan();
 const mutate=(change:(v:any)=>void)=>{
  const data=JSON.parse(encodeEquipmentPlan(p,org,b()));change(data);
  assert.throws(()=>parseEquipmentPlan(JSON.stringify(data),org,b()));
 };
 mutate(x=>{x.sourceDate='2026-02-30';});
 mutate(x=>{x.selectedAssetIds.push(x.selectedAssetIds[0]);});
 mutate(x=>{x.reviewedAt='NOT-A-DATE';});
 mutate(x=>{x.selectedAssetIds=['improper space'];});
 assert.throws(()=>parseEquipmentPlan('{bad',org,b()),/Invalid job equipment plan JSON/i);
 const fabricated=JSON.parse(encodeEquipmentPlan(p,org,b()));
 fabricated.confirmedReserved=true;fabricated.inspectionCertified='fake';fabricated.assetCredentials='secret';
 const clean=parseEquipmentPlan(JSON.stringify(fabricated),org,b());
 assert.equal('confirmedReserved' in clean,false);
 assert.equal('inspectionCertified' in clean,false);
 assert.equal('assetCredentials' in clean,false);
});
test('valid same-day local fleet and load yield selected assets but NOT certified clearance',()=>{
 const data=evaluateEquipmentPlan(plan(),b(),fleet(),[],'2026-10-23');
 assert.equal(data.fleetAvailable,true);
 assert.equal(data.sourceMatches,true);
 assert.equal(data.assigned.length,1);
 assert.equal(data.assigned[0].asset.id,'washer1');
 assert.equal(data.reviewedToday,true);
 assert.equal(data.fleetChecklistFresh,true);
 assert.equal(data.fleetChecklistChecked,10);
 assert.equal(data.knownPayloadOverage,false);
 assert.equal(data.capacityRemainingLb,1500-(500+35*8.34+320+100));
 assert.ok(!data.findings.some(x=>x.type==='stop'));
});
test('unavailable fleet, no assets, stale review are UNKNOWN rather than ready',()=>{
 const missing=evaluateEquipmentPlan(plan(),b(),null,[],'2026-10-24');
 assert.equal(missing.fleetAvailable,false);
 assert.equal(missing.assigned.length,0);
 assert.deepEqual(missing.missingIds,['washer1']);
 assert.equal(missing.reviewedToday,false);
 assert.equal(missing.capacityRemainingLb,null);
 assert.ok(missing.findings.some(x=>x.type==='unknown'));
});
test('out-of-service, overdue service and payload overage are stop findings',()=>{
 const f=fleet();
 f.assets[0].status='out-of-service';
 f.rig.vehiclePayloadLb=200;
 const r=evaluateEquipmentPlan(plan(),b(),f,[],'2026-10-23');
 assert.equal(r.knownPayloadOverage,true);
 assert.ok(r.findings.filter(x=>x.type==='stop').length>=2);
 const f2=fleet();f2.assets[0].nextServiceDate='2026-10-20';
 const due=evaluateEquipmentPlan(plan(),b(),f2,[],'2026-10-23');
 assert.equal(due.assigned[0].health,'due');
 assert.ok(due.findings.some(x=>x.type==='stop'));
});
test('same day shared asset plans warn but never assert actual physical scheduling conflict',()=>{
 const candidate=b({id:'other-book',lead_id:'other-customer'});
 const other={booking:candidate,plan:{...makeEquipmentPlan(org,candidate),selectedAssetIds:['washer1']}};
 const r=evaluateEquipmentPlan(plan(),b(),fleet(),[other],'2026-10-23');
 assert.equal(r.sameDayConflicts.length,1);
 assert.deepEqual(r.sameDayConflicts[0].bookingIds,['other-book']);
 assert.ok(r.findings.some(x=>x.type==='attention'&&/not independently verified/i.test(x.message)));
 assert.equal(evaluateEquipmentPlan(plan(),b(),fleet(),
   [{booking:{...candidate,date:'2026-10-24'},plan:other.plan}],'2026-10-23').sameDayConflicts.length,0);
 assert.equal(evaluateEquipmentPlan(plan(),b(),fleet(),
   [{booking:{...candidate,status:'denied'},plan:other.plan}],'2026-10-23').sameDayConflicts.length,0);
});
test('source drift and cancelled booking fail local readiness despite valid assets',()=>{
 const changed=b({date:'2026-10-24'});
 const result=evaluateEquipmentPlan(plan(),changed,fleet(),[],'2026-10-24');
 assert.equal(result.sourceMatches,false);
 assert.ok(result.findings.some(x=>x.type==='attention'));
 const cancelled=b({status:'cancelled'});
 const c=evaluateEquipmentPlan(plan(),cancelled,fleet(),[],'2026-10-23');
 assert.ok(c.findings.some(x=>x.type==='stop'));
});
test('Fleet validator is reused without mutating or creating source assets',()=>{
 const f=fleet();
 const snapshot=encodeFleet(f,org);
 const r=evaluateEquipmentPlan(plan(),b(),decodeFleet(snapshot,org),[],'2026-10-23');
 assert.equal(r.fleetAvailable,true);
 assert.equal(encodeFleet(f,org),snapshot);
});
