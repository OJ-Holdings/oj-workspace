import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExteriorData,ExtLead} from '../src/lib/exterior';
import {buildCustomerDossier} from '../src/lib/exterior-customer-360';

const lead=(id:string,extra:Partial<ExtLead>={}):ExtLead=>({
 id,name:'Alex',phone:'262-555-0101',address:'100 Oak St, Kenosha WI 53140',
 service_requested:'House wash',quote_amount:325,status:'completed',source:'lsa',
 notes:'Customer prefers weekday mornings.',job_revenue:325,job_cost:40,
 created_at:'2026-05-02T13:00:00Z',updated_at:'2026-06-05T18:00:00Z',
 completed_at:'2026-06-01T15:00:00Z',...extra,
});
const data:ExteriorData={
 leads:[
  lead('main'),lead('shared-phone',{name:'Different person',address:'200 Elm St',status:'new',job_revenue:null,job_cost:null}),
  lead('shared-property',{name:'Another tenant',phone:'262-555-0102',status:'booked'}),
  lead('no-merge',{name:'Alex',phone:'262-555-9999',address:'Another Street 99'}),
 ],
 bookings:[
  {id:'b1',lead_id:'main',date:'2026-06-01',time_block:'9-12',status:'confirmed'},
  {id:'b2',lead_id:'main',date:'2026-10-30',time_block:'12-3',status:'pending_approval'},
  {id:'b3',lead_id:'shared-phone',date:'2026-06-02',time_block:'9-12',status:'confirmed'},
  {id:'b4',lead_id:null,date:'2026-07-01',time_block:null,status:'confirmed'},
 ],
 activity:[],sessions:[],
 extras:{goal:null,upgrades:{},settings:{},quotes:[
  {id:'web1',name:'Alex',phone:'2625550101',email:null,address:null,service_needed:'Window cleaning',
   description:null,property_type:null,business_name:null,recurring_interest:true,created_at:'2026-05-01T00:00:00Z'},
  {id:'web2',name:'Not Alex',phone:'555-789-1234',email:null,address:null,service_needed:null,
   description:null,property_type:null,business_name:null,recurring_interest:false,created_at:'2026-05-01T00:00:00Z'},
 ]},
 coverage:{leads:{loaded:4,total:4},bookings:{loaded:4,total:4},sessions:{loaded:0,total:0}},
};
test('Customer 360 shows bookings only by unchanged lead ID, without phone/name aggregation',()=>{
 const d=buildCustomerDossier(data,'main');
 assert.ok(d);
 assert.deepEqual(d.bookings.map(b=>b.id),['b2','b1']);
 assert.equal(d.lead.id,'main');
 assert.equal(d.money.quote,325);
 assert.equal(d.money.recordedJobRevenue,325);
 assert.equal(d.money.recordedJobCost,40);
 assert.equal(d.money.knownContribution,285);
 assert.ok(d.events.some(e=>e.kind==='completion'&&e.basis==='source-date'));
 assert.ok(d.events.some(e=>e.kind==='booking'&&e.title==='Booking pending approval'));
 assert.equal(d.coverage.complete,true);
 assert.ok(d.coverage.notes.some(x=>/not individual booking/.test(x)));
});
test('website inquiries and other leads are only candidates; name alone does not generate a match',()=>{
 const d=buildCustomerDossier(data,'main');
 assert.ok(d);
 assert.deepEqual(d.candidates.map(c=>c.id),['lead:shared-phone','lead:shared-property','request:web1']);
 assert.equal(d.candidates[0].reason,'Same recorded phone');
 assert.equal(d.candidates[1].reason,'Same recorded address');
 assert.equal(d.candidates[2].kind,'website-request');
 assert.equal(d.bookings.length,2);
 assert.ok(!d.candidates.some(c=>c.id.includes('no-merge')));
});
test('source record missing or unrecognized ID does not fall back to same-name',()=>{
 assert.equal(buildCustomerDossier(data,'unknown'),null);
 assert.equal(buildCustomerDossier(data,''),null);
 assert.equal(buildCustomerDossier(data,'a'.repeat(129)),null);
});
test('missing monetary figures remain unknown, including cost and contribution',()=>{
 const d=buildCustomerDossier({...data,leads:[lead('main',{status:'new',quote_amount:null,job_revenue:null,job_cost:null})]},'main');
 assert.ok(d);
 assert.equal(d.money.quote,null);
 assert.equal(d.money.recordedJobRevenue,null);
 assert.equal(d.money.recordedJobCost,null);
 assert.equal(d.money.knownContribution,null);
 assert.ok(!d.events.some(e=>e.kind==='completion'));
});
test('historical completion date is explicitly estimated rather than silently confirmed',()=>{
 const d=buildCustomerDossier({...data,leads:[lead('main',{completed_at:null})]},'main');
 assert.ok(d);
 const e=d.events.find(e=>e.kind==='completion');
 assert.equal(e?.basis,'estimated-date');
 assert.match(e?.detail??'',/fallback/);
});
test('source coverage remains disclosed when extras unavailable and records capped',()=>{
 const partial={...data,extras:null,coverage:{...data.coverage!,leads:{loaded:4,total:18},bookings:{loaded:4,total:14}}};
 const d=buildCustomerDossier(partial,'main');
 assert.ok(d);
 assert.equal(d.coverage.complete,false);
 assert.equal(d.coverage.notes.length,4);
 assert.ok(d.coverage.notes.some(s=>/partial/.test(s)));
 assert.ok(d.coverage.notes.some(s=>/not available/.test(s)));
 assert.ok(!d.candidates.some(c=>c.kind==='website-request'));
});
test('placeholder phone does not match unrelated identities, even if names coincide',()=>{
 const one=lead('main',{phone:'NO_PHONE_1',address:null});
 const other=lead('other',{phone:'NO_PHONE_1',address:null});
 const d=buildCustomerDossier({...data,leads:[one,other],bookings:[]},'main');
 assert.ok(d);
 assert.deepEqual(d.candidates,[]);
});
test('repeated bookings do not cause lead-level revenue to multiply and no collected property is inferred',()=>{
 const d=buildCustomerDossier(data,'main');
 assert.ok(d);
 assert.equal(d.money.recordedJobRevenue,325);
 assert.equal(d.bookings.length,2);
 assert.equal('collected' in d.money,false);
});
