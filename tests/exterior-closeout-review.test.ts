import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking,ExtLead} from '../src/lib/exterior';
import {newFieldLog,type ExteriorFieldLog} from '../src/lib/exterior-field-log';
import {internalCloseoutBrief,reviewInternalCloseout} from '../src/lib/exterior-closeout-review';

const booking:ExtBooking={id:'b-34',lead_id:'l-34',date:'2026-10-23',time_block:'9-12',status:'confirmed'};
const lead:ExtLead={
 id:'l-34',name:'Example customer',phone:null,address:'Example property',
 service_requested:'Windows',quote_amount:400,status:'booked',source:'website',
 notes:null,job_revenue:null,job_cost:null,created_at:'2026-10-01T00:00:00Z',
 updated_at:null,completed_at:null,
};
const field=():ExteriorFieldLog=>({
 ...newFieldLog(booking),
 stage:'wrap-up',arrivalAt:'2026-10-23T14:00:00.000Z',
 departureAt:'2026-10-23T17:00:00.000Z',
 labor:[{id:'l1',role:'Operator',hours:3,hourlyCost:25,notes:''}],
 materials:[{id:'m1',name:'Soap',quantity:1,unitCost:4,notes:''}],
 travelMiles:8,vehicleCostPerMile:0.5,otherDirectCost:0,
 review:{labor:true,materials:true,travel:true,other:true},
 checks:{water:'ready',ppe:'ready',runoff:'ready',chemicals:'ready',
  pump:'ready',hoses:'ready',pureWater:'not-required'},
 issues:[],siteNotes:'Customer access confirmed locally.',
});
const run=(f:ExteriorFieldLog|null=field(),bs:ExtBooking[]=[booking],coverage=true,l:ExtLead=lead)=>
 reviewInternalCloseout(booking,l,bs,f,coverage);

test('validated local reviewed field evidence produces only internal handoff eligibility',()=>{
 const r=run();
 assert.equal(r.reviewable,true);
 assert.deepEqual(r.blockers,[]);
 assert.equal(r.fieldCost?.totalDirectCost,83);
 assert.equal(r.hoursReviewed,3);
 assert.equal(r.bookingUnique,true);
 assert.match(internalCloseoutBrief(r,lead,booking),/NOT A COMPLETED JOB/);
 assert.match(internalCloseoutBrief(r,lead,booking),/NOT settled/);
 assert.doesNotMatch(internalCloseoutBrief(r,lead,booking),/Invoice number:/);
});
test('new draft cannot appear eligible merely because it is linked to real source records',()=>{
 const r=run(newFieldLog(booking));
 assert.equal(r.reviewable,false);
 for(const code of ['stage','time','labor','materials','travel','other','check-water','check-ppe'])
  assert.ok(r.blockers.some(x=>x.code===code),code);
 assert.equal(r.fieldCost?.totalDirectCost,null);
 assert.equal(r.hoursReviewed,null);
});
test('explicit reviewed zero amounts are valid but unknown amounts are never zero',()=>{
 const f=field();f.labor=[];f.materials=[];f.travelMiles=0;f.vehicleCostPerMile=0;f.otherDirectCost=0;
 assert.equal(run(f).fieldCost?.totalDirectCost,0);
 assert.equal(run(f).reviewable,true);
 f.materials=[{id:'missing',name:'Soap',quantity:1,unitCost:null,notes:''}];
 assert.equal(run(f).reviewable,false);
 assert.equal(run(f).fieldCost?.totalDirectCost,null);
 assert.ok(run(f).blockers.some(x=>x.code==='materials'));
});
test('stop-work and site checklist issue block even with complete costs',()=>{
 const f=field();f.checks.ppe='issue';
 f.issues=[{id:'fault',category:'equipment',severity:'stop-work',description:'Pressure leak',resolved:false}];
 const r=run(f);
 assert.equal(r.reviewable,false);
 assert.ok(r.blockers.some(x=>x.code==='issue-ppe'));
 assert.ok(r.blockers.some(x=>x.code==='stop-work'));
 f.issues[0].resolved=true;f.checks.ppe='ready';
 assert.equal(run(f).reviewable,true);
});
test('attention observations block review but notes remain visible as caution',()=>{
 const f=field();
 f.issues=[{id:'a',category:'site',severity:'attention',description:'Blocked access',resolved:false}];
 assert.ok(run(f).blockers.some(x=>x.code==='open-issues'));
 f.issues[0].severity='note';
 assert.equal(run(f).reviewable,true);
 assert.ok(run(f).cautions.some(x=>/note-level/.test(x)));
});
test('truncated booking coverage and multiple visits cannot assign lead price to a visit',()=>{
 const second={...booking,id:'another',date:'2026-10-24'};
 assert.equal(run(field(),[booking],false).reviewable,false);
 const r=run(field(),[booking,second],true);
 assert.equal(r.reviewable,false);
 assert.equal(r.bookingUnique,false);
 assert.ok(r.blockers.some(x=>x.code==='multiple-visits'));
});
test('cancelled or missing original source and date drift block even when field looks complete',()=>{
 const f=field();
 f.sourceDate='2026-10-22';
 assert.ok(run(f).blockers.some(x=>x.code==='field-stale'));
 assert.ok(run(field(),[]).blockers.some(x=>x.code==='source-missing'));
 const cancelled={...booking,status:'cancelled'};
 const cancelledField={...field(),sourceStatus:'cancelled'};
 const r=reviewInternalCloseout(cancelled,lead,[cancelled],cancelledField,true);
 assert.ok(r.blockers.some(x=>x.code==='booking-inactive'));
});
test('missing field log, invalid field draft and wrong tenant/customer cannot be silently substituted',()=>{
 assert.ok(run(null).blockers.some(x=>x.code==='field-missing'));
 assert.ok(run({...field(),bookingId:'another'}).blockers.some(x=>x.code==='field-missing'));
 assert.throws(()=>reviewInternalCloseout(booking,{...lead,id:'some-other'},[booking],field(),true),/disagree/);
 const r=run();
 assert.throws(()=>internalCloseoutBrief(r,{...lead,id:'some-other'},booking),/disagree/);
});
test('missing lead quote is disclosed, not treated as accepted pricing',()=>{
 const r=run(field(),[booking],true,{...lead,quote_amount:null,job_revenue:1250});
 assert.equal(r.quoteAmount,null);
 assert.ok(r.cautions.some(x=>/proposed billing value is unknown/.test(x)));
 assert.ok(r.cautions.some(x=>/not assigned to this booking/.test(x)));
 assert.match(internalCloseoutBrief(r,{...lead,quote_amount:null},booking),/Unknown/);
});
