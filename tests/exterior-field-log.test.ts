import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking} from '../src/lib/exterior';
import {
 fieldLogFormat,fieldLogVersion,fieldSourceMatches,isFieldLog,newFieldLog,
 parseFieldPackage,reviewFieldLog,serializeFieldPackage,type ExteriorFieldLog,
} from '../src/lib/exterior-field-log';

const org='00000000-0000-4000-8000-000000000001';
const otherOrg='00000000-0000-4000-8000-000000000002';
const bid='11111111-1111-4111-8111-111111111111',lid='22222222-2222-4222-8222-222222222222';
const booking=():ExtBooking=>({id:bid,lead_id:lid,date:'2026-10-23',time_block:'9-12',status:'confirmed'});
const complete=():ExteriorFieldLog=>({
 ...newFieldLog(booking()),stage:'wrap-up',
 arrivalAt:'2026-10-23T14:00:00.000Z',departureAt:'2026-10-23T17:00:00.000Z',
 labor:[{id:'labor1',role:'Owner',hours:2,hourlyCost:25,notes:'Wash house exterior'}],
 materials:[{id:'mat1',name:'Cleaning mix',quantity:3,unitCost:5,notes:'Measured liters'}],
 travelMiles:10,vehicleCostPerMile:.6,otherDirectCost:4,
 review:{labor:true,materials:true,travel:true,other:true},
 checks:{water:'ready',ppe:'ready',runoff:'ready',chemicals:'ready',
  pump:'ready',hoses:'ready',pureWater:'not-required'},
 issues:[],siteNotes:'Water access confirmed by occupant.',
});
test('new field log starts with unknown costs, unchecked safety, and no inferred job completion',()=>{
 const d=newFieldLog(booking());
 const result=reviewFieldLog(d);
 assert.equal(d.bookingId,bid);
 assert.equal(d.leadId,lid);
 assert.equal(d.sourceDate,'2026-10-23');
 assert.equal(d.stage,'preparation');
 assert.equal(d.arrivalAt,null);
 assert.equal(result.hours,0);
 assert.equal(result.knownLaborCost,null);
 assert.equal(result.knownMaterialsCost,null);
 assert.equal(result.knownTravelCost,null);
 assert.equal(result.knownOtherCost,null);
 assert.equal(result.totalDirectCost,null);
 assert.equal(result.recordedSubset,0);
 assert.equal(result.complete,false);
 assert.equal(result.uncheckedSafety,4);
 assert.equal('completed' in d,false);
 assert.equal('revenue' in d,false);
 assert.equal('paid' in d,false);
});
test('fully reviewed actual labor/material/travel/other are combined without fabricating revenue',()=>{
 const result=reviewFieldLog(complete());
 assert.equal(result.hours,2);
 assert.equal(result.knownLaborCost,50);
 assert.equal(result.knownMaterialsCost,15);
 assert.equal(result.knownTravelCost,6);
 assert.equal(result.knownOtherCost,4);
 assert.equal(result.totalDirectCost,75);
 assert.equal(result.recordedSubset,75);
 assert.equal(result.complete,true);
 assert.equal(result.uncheckedSafety,0);
 assert.ok(result.flags.some(f=>/No verified booking-specific revenue/i.test(f)));
});
test('partial review discloses known subset but withholds total direct cost',()=>{
 const d=complete();d.materials[0].unitCost=null;d.review.travel=false;
 const r=reviewFieldLog(d);
 assert.equal(r.knownLaborCost,50);
 assert.equal(r.knownMaterialsCost,null);
 assert.equal(r.knownTravelCost,null);
 assert.equal(r.knownOtherCost,4);
 assert.equal(r.recordedSubset,54);
 assert.equal(r.totalDirectCost,null);
 assert.ok(r.flags.some(f=>/unknown/i.test(f)));
});
test('reviewed explicit zeros are valid but missing numbers never silently count as zeros',()=>{
 const d=complete();d.labor=[];d.materials=[];d.travelMiles=0;d.vehicleCostPerMile=0;d.otherDirectCost=0;
 const r=reviewFieldLog(d);assert.equal(r.totalDirectCost,0);assert.equal(r.complete,true);
 d.review.materials=false;
 assert.equal(reviewFieldLog(d).totalDirectCost,null);
});
test('safety concerns and stop-work observations never imply clearance',()=>{
 const d=complete();
 d.checks.runoff='issue';
 d.issues=[{id:'issue1',category:'equipment',severity:'stop-work',description:'Hose coupling leaking under pressure',resolved:false}];
 const r=reviewFieldLog(d);
 assert.equal(r.criticalIssues,1);
 assert.equal(r.issuesOpen,1);
 assert.ok(r.flags.some(f=>/stop-work/i.test(f)));
 assert.ok(r.flags.some(f=>/safety/i.test(f)));
 d.issues[0].resolved=true;
 assert.equal(reviewFieldLog(d).criticalIssues,0);
});
test('field evidence is bound only to the exact original booking and lead',()=>{
 const d=newFieldLog(booking());
 assert.equal(fieldSourceMatches(d,booking()),true);
 assert.equal(fieldSourceMatches(d,{...booking(),id:'other'}),false);
 assert.equal(fieldSourceMatches(d,{...booking(),lead_id:'different'}),false);
 assert.equal(fieldSourceMatches(d,{...booking(),date:'2026-10-24'}),false);
 assert.equal(fieldSourceMatches(d,{...booking(),status:'denied'}),false);
});
test('private field package roundtrips with exact organization/booking/customer identity',()=>{
 const original=complete();
 const p=serializeFieldPackage(org,original,new Date('2026-10-23T20:00:00.000Z'));
 const parsed=parseFieldPackage(p,org,bid,lid);
 assert.deepEqual(parsed,original);
 const wrapper=JSON.parse(p);
 assert.equal(wrapper.format,fieldLogFormat);
 assert.equal(wrapper.version,fieldLogVersion);
 assert.equal(wrapper.status,'internal-field-draft');
 assert.equal('invoice' in wrapper,false);
 assert.equal('bookingCompleted' in wrapper,false);
 assert.equal('customerSignature' in wrapper,false);
});
test('tenant/cross-booking substitution and forged finalized statuses fail closed',()=>{
 const p=serializeFieldPackage(org,complete());
 assert.throws(()=>parseFieldPackage(p,otherOrg,bid,lid),/another organization/);
 assert.throws(()=>parseFieldPackage(p,org,'different',lid),/another booking/);
 assert.throws(()=>parseFieldPackage(p,org,bid,'different'),/another booking/);
 const val=JSON.parse(p);
 val.status='customer-accepted';
 assert.throws(()=>parseFieldPackage(JSON.stringify(val),org,bid,lid),/falsely finalized/i);
});
test('invalid numbers, reversed timestamps, duplicate identifiers and unknown safety states are rejected',()=>{
 const value=JSON.parse(serializeFieldPackage(org,complete()));
 const invalid=(fn:(v:any)=>void)=>{
  const clone=structuredClone(value);fn(clone);
  assert.throws(()=>parseFieldPackage(JSON.stringify(clone),org,bid,lid));
 };
 invalid(v=>{v.log.labor[0].hours=-1;});
 invalid(v=>{v.log.materials[0].unitCost='unknown';});
 invalid(v=>{v.log.departureAt='2026-10-23T13:00:00.000Z';});
 invalid(v=>{v.log.checks.ppe='approved by OSHA';});
 invalid(v=>{v.log.materials.push(v.log.materials[0]);});
 invalid(v=>{v.log.issues=[{id:'1',category:'weather',severity:'stop-work',description:'',resolved:false}];});
 assert.throws(()=>parseFieldPackage('{oops',org,bid,lid),/not valid JSON/i);
 assert.equal(isFieldLog({...complete(),sourceDate:'2026-02-30'}),false);
});
test('untrusted extra fields in imported package are stripped, never interpreted as payments',()=>{
 const val=JSON.parse(serializeFieldPackage(org,complete()));
 val.confirmedPaid=true;val.log.customerApproved=true;val.log.labor[0].bankAccount='untrusted';
 val.log.checks.unsafeExtra={action:'skip'};
 val.log.issues=[{id:'a',category:'equipment',severity:'note',description:'Observation',resolved:false,compensation:999}];
 const p=parseFieldPackage(JSON.stringify(val),org,bid,lid);
 assert.equal('customerApproved' in p,false);
 assert.equal('bankAccount' in p.labor[0],false);
 assert.equal('unsafeExtra' in p.checks,false);
 assert.equal('compensation' in p.issues[0],false);
});
