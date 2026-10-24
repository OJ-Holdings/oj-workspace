import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking,ExtLead,ExteriorData} from '../src/lib/exterior';
import {
 buildDispatchPreflight,qualifiedDispatchQuotes,quoteAttributionForBooking,
} from '../src/lib/exterior-dispatch-preflight';

const lead=(id:string,extra:Partial<ExtLead>={}):ExtLead=>({
 id,name:'Customer '+id,phone:'+12625550123',address:'123 Realistic Example Road',
 service_requested:'Exterior washing',quote_amount:325,status:'booked',
 source:'LSA',notes:null,job_revenue:null,job_cost:null,
 created_at:'2026-10-21T18:00:00Z',updated_at:null,completed_at:null,...extra,
});
const book=(id:string,lead_id:string|null,date='2026-10-23',time_block:string|null='9-12',
 status:string|null='confirmed'):ExtBooking=>({id,lead_id,date,time_block,status});
const data=(leads:ExtLead[],bookings:ExtBooking[],totals?:{leads:number|null;bookings:number|null}):ExteriorData=>({
 leads,bookings,activity:[],sessions:[],extras:null,
 coverage:{leads:{loaded:leads.length,total:totals?.leads??leads.length},
  bookings:{loaded:bookings.length,total:totals?.bookings??bookings.length},
  sessions:{loaded:0,total:0}},
});
const inspect=(d:ExteriorData)=>buildDispatchPreflight(d,'2026-10-23');

test('source-backed upcoming jobs show confirmed, pending and verified quoted totals separately',()=>{
 const a=book('A','a'),b=book('B','b','2026-10-24','1-3','pending_approval');
 const d=data([lead('a'),lead('b',{quote_amount:275})],[a,b]);
 const p=inspect(d);
 assert.equal(p.counts.upcoming,2);
 assert.equal(p.counts.confirmed,1);
 assert.equal(p.counts.pending,1);
 assert.equal(p.counts.blocked,1);
 assert.equal(p.price.total,325);
 assert.equal(p.price.confirmed,1);
 assert.equal(p.price.eligible,1);
 assert.equal(p.rows[1].findings.some(f=>f.code==='pending-approval'),true);
 assert.equal('actualRevenue' in p,false);
 assert.equal('customerAccepted' in p.rows[0],false);
});
test('same lead with second active visit makes *both* visit prices unattributable',()=>{
 const a=book('A','a'),b=book('B','a','2026-10-28');
 const d=data([lead('a')],[a,b]);
 assert.equal(quoteAttributionForBooking(a,d.leads[0],d.bookings,d),null);
 assert.equal(inspect(d).price.total,null);
 assert.equal(inspect(d).price.notAttributable,2);
 assert.ok(inspect(d).rows.every(r=>r.findings.some(f=>f.code==='quote-identity')));
});
test('past active visit still prevents assigning a lead-level amount to upcoming visit',()=>{
 const earlier=book('old','a','2026-09-18'),current=book('new','a');
 const d=data([lead('a')],[earlier,current]);
 assert.equal(inspect(d).rows.length,1);
 assert.equal(inspect(d).rows[0].quotedVisitAmount,null);
 assert.equal(inspect(d).price.total,null);
});
test('denied and cancelled visits never consume quote attribution or appear on dispatch',()=>{
 const a=book('A','a'),b=book('B','a','2026-10-24','9-12','denied');
 const c=book('C','a','2026-10-25','9-12','cancelled');
 const d=data([lead('a')],[a,b,c]);
 assert.equal(inspect(d).rows.length,1);
 assert.equal(inspect(d).price.total,325);
});
test('partial or unknown source coverage withholds booked quote total and discloses ambiguity',()=>{
 const a=book('A','a');
 const d=data([lead('a')],[a],{leads:2,bookings:3});
 assert.equal(inspect(d).sourceComplete,false);
 assert.equal(inspect(d).price.total,null);
 assert.equal(inspect(d).rows[0].findings.some(f=>f.code==='quote-identity'),true);
 const unknown={...d,coverage:undefined};
 assert.equal(inspect(unknown).price.total,null);
 assert.equal(qualifiedDispatchQuotes(unknown,[a]).sourceComplete,false);
});
test('no confirmed visit is unknown, not zero booked revenue',()=>{
 const d=data([lead('a')],[book('B','a','2026-10-24','12-3','pending_approval')]);
 assert.equal(inspect(d).price.total,null);
 assert.equal(inspect(d).price.confirmed,0);
});
test('unknown, zero, negative and invalid quote prices are never interpreted as accepted price',()=>{
 for(const quote of [null,0,-1,Infinity,NaN]){
  const d=data([lead('a',{quote_amount:quote})],[book('A','a')]);
  assert.equal(inspect(d).price.total,null);
  assert.equal(inspect(d).price.notAttributable,1);
 }
});
test('overlapping windows prompt *capacity review*, not false impossibility',()=>{
 const d=data([lead('a'),lead('b'),lead('c')],[
  book('A','a','2026-10-23','9-12'),
  book('B','b','2026-10-23','11-2'),
  book('C','c','2026-10-23','2-5'),
 ]);
 const p=inspect(d);
 assert.equal(p.counts.overlaps,2);
 assert.equal(p.rows[0].hasTimeOverlap,true);
 assert.equal(p.rows[1].hasTimeOverlap,true);
 assert.equal(p.rows[2].hasTimeOverlap,false);
 assert.equal(p.rows[0].findings.find(x=>x.code==='overlap')?.level,'attention');
 assert.match(p.rows[0].findings.find(x=>x.code==='overlap')!.label,/crew\/rig capacity/);
});
test('missing slot, address, contact, service and linked customer surface distinct corrections',()=>{
 const d=data([lead('a',{phone:'NP_01234',address:'',service_requested:null})],[
  book('bad','a','2026-10-24',null),book('orphan','missing','2026-10-25','9-12'),
 ]);
 const p=inspect(d);
 for(const code of ['site-address','contact','scope','time'])assert.ok(p.rows[0].findings.some(f=>f.code===code),code);
 assert.equal(p.rows[1].leadId,null);
 assert.ok(p.rows[1].findings.some(f=>f.code==='lead-absent'));
 assert.equal(p.counts.blocked,2);
});
test('unknown source status is not a confirmed work order or money',()=>{
 const d=data([lead('a')],[book('A','a','2026-10-23','9-12',null)]);
 const p=inspect(d);
 assert.equal(p.rows[0].isConfirmed,false);
 assert.equal(p.price.confirmed,0);
 assert.equal(p.rows[0].findings[0].code,'unconfirmed-status');
});
test('business-day window is inclusive through day 14 and stable across DST boundary',()=>{
 const d=data([lead('a'),lead('b'),lead('c')],[
  book('late','c','2026-11-07','9-12'),
  book('inside','a','2026-11-06','9-12'),
  book('before','b','2026-11-01','9-12'),
 ]);
 const p=buildDispatchPreflight(d,'2026-10-23',14);
 assert.equal(p.through,'2026-11-06');
 assert.deepEqual(p.rows.map(x=>x.id),['before','inside']);
 assert.throws(()=>buildDispatchPreflight(d,'2026-02-30'));
 assert.throws(()=>buildDispatchPreflight(d,'2026-10-23',1000));
 assert.equal(buildDispatchPreflight(d,'2026-10-23',0).rows.length,0);
});
test('new source snapshot is not mutated and uncertain counts stay source-window scoped',()=>{
 const a=book('A','a'),d=data([lead('a')],[a]);
 const original=JSON.stringify(d);
 const p=inspect(d);
 assert.equal(JSON.stringify(d),original);
 assert.equal(p.rows[0].quotedVisitAmount,325);
 assert.equal(p.counts.attention,0);
});
test('two adjacent valid bookings are not an overlap when one ends at the next start',()=>{
 const d=data([lead('a'),lead('b')],[book('A','a','2026-10-23','9-12'),book('B','b','2026-10-23','12-3')]);
 assert.equal(inspect(d).counts.overlaps,0);
});
test('data-limited month rollups with multiple customers and multiple visits cannot overstate totals',()=>{
 const d=data([lead('a'),lead('b',{quote_amount:250})],[
  book('A','a'),book('B','b','2026-10-25','9-12'),book('C','a','2026-11-15','9-12'),
 ]);
 assert.equal(qualifiedDispatchQuotes(d,d.bookings.filter(b=>b.date<='2026-10-31')).total,null);
 assert.equal(qualifiedDispatchQuotes(d,[d.bookings[1]]).total,250);
});
