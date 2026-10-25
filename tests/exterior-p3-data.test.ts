import test from 'node:test';
import assert from 'node:assert/strict';
import {readP3BookingProjection,type P3ReadPort} from '../src/lib/exterior-p3-data';

const ids={
 org:'10000000-0000-4000-8000-000000000001',
 org2:'10000000-0000-4000-8000-000000000002',
 lead:'legacy-lead:001',booking:'legacy-booking:001',
 customer:'30000000-0000-4000-8000-000000000001',
 property:'40000000-0000-4000-8000-000000000001',
 opp:'50000000-0000-4000-8000-000000000001',
 quote:'60000000-0000-4000-8000-000000000001',
 version:'70000000-0000-4000-8000-000000000001',
 order:'a0000000-0000-4000-8000-000000000001',
};
const booking={id:ids.booking,lead_id:ids.lead,date:'2026-11-06',time_block:'9-12',status:'confirmed'};
const lead={id:ids.lead,name:'Example Customer',address:'123 Example Lane',
 service_requested:'Exterior window cleaning',updated_at:'2026-10-24T10:00:00Z',
 quote_amount:225};
function sample(){
 let reads=0;
 const port:P3ReadPort={
  booking:async id=>{reads++;return id===ids.booking?{...booking}:null;},
  lead:async id=>id===ids.lead?{...lead}:null,
  link:async(org,id)=>org===ids.org&&id===ids.lead?{
   organization_id:ids.org,legacy_lead_id:ids.lead,customer_id:ids.customer,property_id:ids.property,
  }:null,
  customer:async(org,id)=>org===ids.org&&id===ids.customer?{
   organization_id:ids.org,id,display_name:'Example LLC',
  }:null,
  property:async(org,id)=>org===ids.org&&id===ids.property?{
   organization_id:ids.org,id,customer_id:ids.customer,address_text:'123 Example Lane',
  }:null,
  opportunity:async(org,leadId,bookingId)=>org===ids.org&&leadId===ids.lead&&bookingId===ids.booking?{
   organization_id:ids.org,id:ids.opp,legacy_lead_id:ids.lead,customer_id:ids.customer,
   property_id:ids.property,target_booking_id:ids.booking,
  }:null,
  quote:async(org,id)=>org===ids.org&&id===ids.opp?{
   organization_id:ids.org,id:ids.quote,opportunity_id:ids.opp,revision:1,
   latest_version_sequence:1,
  }:null,
  version:async(org,id,n)=>org===ids.org&&id===ids.quote&&n===1?{
   organization_id:ids.org,id:ids.version,quote_id:ids.quote,sequence:1,
   source_updated_at:lead.updated_at,source_quote_cents:22500,price_cents:22500,
   content_hash:'a'.repeat(64),
   scope:[{id:'line-1',service:'Exterior window cleaning',unit:'pane',
    quantity:20,unitPriceCents:1125,notes:'Exterior only'}],
  }:null,
  orders:async(org,id)=>org===ids.org&&id===ids.booking?[{
   organization_id:ids.org,id:ids.order,opportunity_id:ids.opp,quote_id:ids.quote,
   version_id:ids.version,booking_id:ids.booking,status:'planned',price_cents:22500,
  }]:[],
 };
 return {port,readCount:()=>reads};
}
test('R50 joins exact source lead, canonical property, immutable scope and a planned order',async()=>{
 const {port,readCount}=sample();
 const r=await readP3BookingProjection(port,ids.org,ids.booking);
 assert.equal(r.ok,true);
 if(!r.ok)return;
 assert.equal(r.state,'linked');
 assert.equal(r.projection.canonical?.customerName,'Example LLC');
 assert.equal(r.projection.canonical?.site,'123 Example Lane');
 assert.equal(r.projection.quote?.priceCents,22500);
 assert.equal(r.projection.quote?.scope[0].quantity,20);
 assert.equal(r.projection.orders[0].status,'planned');
 assert.equal(readCount(),2);
 assert.doesNotMatch(JSON.stringify(r),/accepted|invoice|paid|customer signature/i);
});
test('R50 refuses unmapped legacy source details for any company',async()=>{
 const {port}=sample();port.link=async()=>null;
 const r=await readP3BookingProjection(port,ids.org,ids.booking);
 assert.deepEqual(r,{ok:false,reason:'not-linked'});
 assert.doesNotMatch(JSON.stringify(r),/Example|Lane|window cleaning/i);
});
test('R50 refuses invalid org/booking IDs without querying protected records',async()=>{
 const {port,readCount}=sample();
 assert.deepEqual(await readP3BookingProjection(port,'not-an-org',ids.booking),
  {ok:false,reason:'invalid-source'});
 assert.deepEqual(await readP3BookingProjection(port,ids.org,' booking\nBAD '),
  {ok:false,reason:'invalid-source'});
 assert.equal(readCount(),0);
});
test('R50 avoids cross-org customer/property/work-order projection',async()=>{
 const {port}=sample();const fn=port.property;
 port.property=async(...args)=>({...((await fn(...args))!),organization_id:ids.org2});
 await assert.rejects(readP3BookingProjection(port,ids.org,ids.booking),/inconsistent/);
});
test('R50 refuses wrong canonical lead ID or exact opportunity visit',async()=>{
 const a=sample().port;
 a.link=async()=>({organization_id:ids.org,legacy_lead_id:'other-source',
  customer_id:ids.customer,property_id:ids.property});
 await assert.rejects(readP3BookingProjection(a,ids.org,ids.booking),/inconsistent/);
 const b=sample().port;const fn=b.opportunity;
 b.opportunity=async(...args)=>({...((await fn(...args))!),target_booking_id:'wrong-booking'});
 await assert.rejects(readP3BookingProjection(b,ids.org,ids.booking),/inconsistent/);
});
test('R50 quote revisions changing mid-read fail closed (two-device conflict)',async()=>{
 const {port}=sample();const fn=port.quote;let calls=0;
 port.quote=async(...args)=>({...((await fn(...args))!),revision:++calls});
 const r=await readP3BookingProjection(port,ids.org,ids.booking);
 assert.deepEqual(r,{ok:false,reason:'changed-source'});
});
test('R50 original booking moving to a new time mid-read cannot be claimed current',async()=>{
 const {port}=sample();const fn=port.booking;let calls=0;
 port.booking=async id=>({...((await fn(id))!),time_block:++calls>1?'12-3':'9-12'});
 const r=await readP3BookingProjection(port,ids.org,ids.booking);
 assert.deepEqual(r,{ok:false,reason:'changed-source'});
});
test('R50 original lead revision drift fails closed',async()=>{
 const {port}=sample();let calls=0;const fn=port.lead;
 port.lead=async id=>({...((await fn(id))!),updated_at:++calls>1?'2026-11-01T00:00:00Z':lead.updated_at});
 assert.deepEqual(await readP3BookingProjection(port,ids.org,ids.booking),
  {ok:false,reason:'changed-source'});
});
test('R50 public quote scope refuses confidential cost fields',async()=>{
 const {port}=sample();const fn=port.version;
 port.version=async(...args)=>{
  const v=(await fn(...args))!;
  return {...v,scope:[{id:'line',service:'Windows',unit:'pane',quantity:1,
   unitPriceCents:22500,costPerUnit:3}]};
 };
 await assert.rejects(readP3BookingProjection(port,ids.org,ids.booking),/inconsistent/);
});
test('R50 missing latest version never masquerades as zero-dollar unaccepted quote',async()=>{
 const {port}=sample();port.version=async()=>null;
 await assert.rejects(readP3BookingProjection(port,ids.org,ids.booking),/inconsistent/);
});
test('R50 two work orders for one original booking are an integrity failure',async()=>{
 const {port}=sample();const fn=port.orders;
 port.orders=async(...args)=>{const r=await fn(...args);return [...r,...r];};
 assert.deepEqual(await readP3BookingProjection(port,ids.org,ids.booking),
  {ok:false,reason:'inconsistent-source'});
});
test('R50 booking cancelled remains source truth, even with a historical planned order',async()=>{
 const {port}=sample();const fn=port.booking;
 port.booking=async id=>({...((await fn(id))!),status:'cancelled'});
 const r=await readP3BookingProjection(port,ids.org,ids.booking);
 assert.equal(r.ok,true);
 if(!r.ok)return;
 assert.equal(r.projection.source.status,'cancelled');
 assert.equal(r.projection.orders[0].status,'planned');
});
test('R50 source quote edits are flagged, never treated as accepted or collected',async()=>{
 const {port}=sample();const fn=port.version;
 port.version=async(...args)=>({...((await fn(...args))!),source_quote_cents:1000});
 const r=await readP3BookingProjection(port,ids.org,ids.booking);
 assert.equal(r.ok,true);
 if(r.ok)assert.ok(r.projection.flags.includes('source-quote-changed'));
});
test('R50 missing P3 schema or denied source query is not a fake empty portfolio',async()=>{
 const {port}=sample();
 port.link=async()=>{throw Error('relation does not exist');};
 await assert.rejects(readP3BookingProjection(port,ids.org,ids.booking),/relation does not exist/);
});
