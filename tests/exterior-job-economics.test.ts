import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking,ExtLead} from '../src/lib/exterior';
import {newExteriorEstimate,type ExteriorEstimate} from '../src/lib/exterior-estimate';
import {newFieldLog,type ExteriorFieldLog} from '../src/lib/exterior-field-log';
import {jobEconomicsInternalBrief,reviewJobEconomics} from '../src/lib/exterior-job-economics';

const leadId='11111111-1111-4111-8111-111111111111';
const bookingId='22222222-2222-4222-8222-222222222222';
const lead=(patch:Partial<ExtLead>={}):ExtLead=>({
 id:leadId,name:'Test customer',phone:'+12625550123',address:'100 Field Test Drive',
 service_requested:'Exterior clean',quote_amount:325,status:'booked',source:'website',
 notes:null,job_revenue:null,job_cost:null,created_at:'2026-10-20T12:00:00Z',
 updated_at:'2026-10-23T14:00:00Z',completed_at:null,...patch,
});
const booking=(patch:Partial<ExtBooking>={}):ExtBooking=>({
 id:bookingId,lead_id:leadId,date:'2026-10-23',time_block:'9-12',status:'confirmed',...patch,
});
const completeField=():ExteriorFieldLog=>({
 ...newFieldLog(booking()),
 arrivalAt:'2026-10-23T14:00:00.000Z',departureAt:'2026-10-23T17:00:00.000Z',
 stage:'wrap-up',labor:[{id:'l1',role:'Founding operator',hours:2,hourlyCost:25,notes:''}],
 materials:[{id:'m1',name:'Cleaning solution',quantity:3,unitCost:5,notes:''}],
 travelMiles:10,vehicleCostPerMile:.6,otherDirectCost:4,
 review:{labor:true,materials:true,travel:true,other:true},
});
const localPlan=():ExteriorEstimate=>({
 ...newExteriorEstimate(lead()),
 lines:[{id:'scope',service:'Exterior clean',quantity:1,unit:'flat',pricePerUnit:325,costPerUnit:30,notes:''}],
 travelCost:10,discount:0,contingencyPct:0,
});
test('source-unique fully reviewed booking shows only qualified quoted-price scenario',()=>{
 const r=reviewJobEconomics(booking(),lead(),[booking()],completeField(),localPlan());
 assert.equal(r.sourceBookingCurrent,true);
 assert.equal(r.sourceBookingCount,1);
 assert.equal(r.estimateSourceCurrent,true);
 assert.equal(r.fieldSourceCurrent,true);
 assert.equal(r.quoteAmount,325);
 assert.equal(r.planned?.cost,40);
 assert.equal(r.field?.totalDirectCost,75);
 assert.equal(r.fieldHoursReviewed,2);
 assert.equal(r.quoteLessFieldCost,250);
 assert.equal(r.quoteLessFieldCostRatio,76.92);
 assert.equal(r.plannedCostMinusFieldCost,-35);
 assert.equal(r.comparable,true);
 assert.equal(r.quoteAccepted,'unverified');
 const report=jobEconomicsInternalBrief(r,lead(),booking());
 assert.match(report,/INTERNAL JOB ECONOMICS REVIEW/);
 assert.match(report,/NOT A CUSTOMER PROPOSAL/);
 assert.match(report,/SCENARIO ONLY/);
 assert.match(report,/Booking ID/);
});
test('multiple bookings attached to a lead disallow lead-quote attribution to one visit',()=>{
 const another=booking({id:'another-booking',date:'2026-10-30'});
 const r=reviewJobEconomics(booking(),lead(),[booking(),another],completeField(),localPlan());
 assert.equal(r.sourceBookingCount,2);
 assert.equal(r.quoteLessFieldCost,null);
 assert.equal(r.quoteLessFieldCostRatio,null);
 assert.equal(r.plannedCostMinusFieldCost,null);
 assert.equal(r.comparable,false);
 assert.ok(r.comparisonReasons.some(x=>/multiple/i.test(x)));
});
test('cancelled another booking does not count as second active booking, but does not prove customer acceptance',()=>{
 const cancelled=booking({id:'cancelled2',date:'2026-10-30',status:'cancelled'});
 const r=reviewJobEconomics(booking(),lead(),[booking(),cancelled],completeField(),localPlan());
 assert.equal(r.sourceBookingCount,1);
 assert.equal(r.quoteAccepted,'unverified');
 assert.equal(r.quoteLessFieldCost,250);
});
test('missing field category and missing quote withhold hypothetical margin or payment claims',()=>{
 const field=completeField();
 field.travelMiles=null;field.review.travel=false;
 const r=reviewJobEconomics(booking(),lead(),[booking()],field,localPlan());
 assert.equal(r.field?.totalDirectCost,null);
 assert.equal(r.field?.recordedSubset,69);
 assert.equal(r.quoteLessFieldCost,null);
 assert.equal(r.comparable,false);
 assert.equal(r.fieldHoursReviewed,2);
 assert.ok(r.comparisonReasons.some(x=>/four categories/i.test(x)));
 const missing=reviewJobEconomics(booking(),lead({quote_amount:null}),[booking()],completeField(),null);
 assert.equal(missing.quoteAmount,null);
 assert.equal(missing.quoteLessFieldCost,null);
 assert.equal(missing.planned,null);
 assert.ok(missing.warnings.some(x=>/another device/i.test(x)));
});
test('source drift prevents using stale field costs for this booking',()=>{
 const altered=booking({date:'2026-10-24'});
 const r=reviewJobEconomics(altered,lead(),[altered],completeField(),localPlan());
 assert.equal(r.fieldSourceCurrent,false);
 assert.equal(r.quoteLessFieldCost,null);
 assert.equal(r.plannedCostMinusFieldCost,null);
 assert.ok(r.comparisonReasons.some(x=>/date\/status/i.test(x)));
});
test('stale local estimate is visible as unapproved plan but not a valid plan-vs-field variance',()=>{
 const r=reviewJobEconomics(booking(),lead({updated_at:'2026-10-23T15:00:00Z'}),[booking()],completeField(),localPlan());
 assert.equal(r.estimateSourceCurrent,false);
 assert.equal(r.planned?.cost,40);
 assert.equal(r.plannedCostMinusFieldCost,null);
 assert.ok(r.warnings.some(x=>/may be stale/i.test(x)));
});
test('invalid or mismatched field log never becomes booking evidence',()=>{
 const other=newFieldLog(booking({id:'other'}));
 const r=reviewJobEconomics(booking(),lead(),[booking()],other,localPlan());
 assert.equal(r.fieldSourceCurrent,false);
 assert.equal(r.field,null);
 assert.equal(r.quoteLessFieldCost,null);
 assert.throws(()=>reviewJobEconomics(booking({lead_id:'wrong-lead'}),lead(),[booking()],completeField(),localPlan()),/exact customer/);
});
test('lead-level recorded job revenue and cost never enter this booking scenario',()=>{
 const existing=lead({job_revenue:1900,job_cost:120,quote_amount:325,status:'completed'});
 const r=reviewJobEconomics(booking(),existing,[booking()],completeField(),localPlan());
 assert.equal(r.quoteLessFieldCost,250);
 assert.notEqual(r.quoteLessFieldCost,1900-75);
 assert.ok(r.warnings.some(x=>/Historical lead-level/i.test(x)));
 const text=jobEconomicsInternalBrief(r,existing,booking());
 assert.doesNotMatch(text,/\$1,900/);
});
test('source snapshot omissions withhold all scenarios even if a local field draft is complete',()=>{
 const r=reviewJobEconomics(booking(),lead(),[],completeField(),localPlan());
 assert.equal(r.sourceBookingCurrent,false);
 assert.equal(r.sourceBookingCount,0);
 assert.equal(r.quoteLessFieldCost,null);
 assert.equal(r.comparable,false);
 assert.ok(r.comparisonReasons.some(x=>/loaded matching snapshot/i.test(x)));
});
test('manually reviewed zero direct costs are meaningful but not bank proof',()=>{
 const f=completeField();
 f.labor=[];f.materials=[];f.travelMiles=0;f.vehicleCostPerMile=0;f.otherDirectCost=0;
 const r=reviewJobEconomics(booking(),lead(),[booking()],f,localPlan());
 assert.equal(r.field?.totalDirectCost,0);
 assert.equal(r.quoteLessFieldCost,325);
 assert.equal(r.quoteLessFieldCostRatio,100);
 assert.equal(r.quoteAccepted,'unverified');
});
