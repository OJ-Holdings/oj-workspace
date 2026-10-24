import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtLead,ExtBooking,ExteriorData} from '../src/lib/exterior';
import {buildJobContinuity} from '../src/lib/exterior-job-continuity';

const lead:ExtLead={
 id:'lead-a',name:'Example only',phone:'+12625551234',address:'123 Example Lane',
 service_requested:'House wash',quote_amount:325,status:'booked',source:'LSA',
 notes:'Do not publish private notes',job_revenue:900,job_cost:150,
 created_at:'2026-10-20T12:00:00Z',updated_at:null,completed_at:null,
};
const booking:ExtBooking={
 id:'booking-a',lead_id:lead.id,date:'2026-10-28',time_block:'9-12',status:'confirmed',
};
const data=(bookings:ExtBooking[]=[booking],leads:ExtLead[]=[lead]):ExteriorData=>({
 leads,bookings,activity:[],sessions:[],extras:null,
 coverage:{leads:{loaded:leads.length,total:leads.length},
  bookings:{loaded:bookings.length,total:bookings.length},
  sessions:{loaded:0,total:0}},
});
const crew={available:true,employeeName:'Jacob'};

test('P1 exact customer/booking supports sourced steps with zero false cash or field sync',()=>{
 const x=buildJobContinuity(data(),booking,crew);
 assert.equal(x.bookingId,booking.id);
 assert.equal(x.leadId,lead.id);
 assert.equal(x.visitPrice,325);
 assert.equal(x.status,'confirmed');
 assert.equal(x.sourceLinked,true);
 assert.equal(x.sourceCoverage,'complete');
 assert.equal(x.steps.find(s=>s.key==='customer')?.evidence,'source');
 assert.equal(x.steps.find(s=>s.key==='quote')?.evidence,'source');
 assert.equal(x.steps.find(s=>s.key==='booking')?.evidence,'source');
 assert.equal(x.steps.find(s=>s.key==='crew')?.evidence,'source');
 assert.equal(x.steps.find(s=>s.key==='field')?.evidence,'local-only');
 assert.equal(x.steps.find(s=>s.key==='payment')?.evidence,'not-built');
 assert.match(x.steps.find(s=>s.key==='payment')!.detail,/not implemented/);
 assert.equal(x.steps.some(s=>/collected:|paid:true|signed off/i.test(s.detail)),false);
});
test('repeated active appointments with one lead withhold per-visit quote and cash attribution',()=>{
 const second={...booking,id:'booking-b',date:'2026-11-01'};
 const x=buildJobContinuity(data([booking,second]),booking,crew);
 assert.equal(x.visitPrice,null);
 assert.equal(x.steps.find(s=>s.key==='quote')?.evidence,'review');
 assert.equal(x.steps.find(s=>s.key==='payment')?.evidence,'not-built');
 assert.equal(x.steps.some(s=>s.detail.includes('$900')),false);
});
test('partial and unknown record coverage withhold quote even for a single confirmed booking',()=>{
 const d=data();
 d.coverage!.leads.total=2;
 assert.equal(buildJobContinuity(d,booking,crew).visitPrice,null);
 assert.equal(buildJobContinuity(d,booking,crew).sourceCoverage,'partial');
 assert.match(buildJobContinuity(d,booking,crew).steps[1].detail,/history is incomplete/);
 assert.equal(buildJobContinuity({...d,coverage:undefined},booking,crew).visitPrice,null);
});
test('pending, denied, cancelled, missing time or unknown status never imply dispatch',()=>{
 for(const status of ['pending_approval','denied','cancelled',null]){
  const b={...booking,status};
  const r=buildJobContinuity(data([b]),b,crew);
  assert.equal(r.visitPrice,null);
  assert.equal(r.steps.find(s=>s.key==='booking')!.evidence,'review');
 }
 const missing={...booking,time_block:null};
 const s=buildJobContinuity(data([missing]),missing,crew);
 assert.equal(s.steps.find(q=>q.key==='booking')?.evidence,'review');
 assert.match(s.steps.find(q=>q.key==='booking')!.detail,/time block/);
});
test('unlinked source cannot inherit different customer names, quotes or site details',()=>{
 const orphan={...booking,lead_id:'deleted-lead'};
 const s=buildJobContinuity(data([orphan]),orphan,crew);
 assert.equal(s.leadId,null);
 assert.equal(s.sourceLinked,false);
 assert.equal(s.visitPrice,null);
 assert.equal(s.steps.find(q=>q.key==='customer')?.evidence,'review');
 assert.match(s.steps[0].detail,/missing/);
 assert.equal(s.steps.some(q=>q.detail.includes('123 Example Lane')),false);
});
test('customer with source gaps is linked but requires review, without assumptions',()=>{
 const bad={...lead,address:null,phone:null,service_requested:null};
 const s=buildJobContinuity(data([booking],[bad]),booking,crew);
 assert.equal(s.sourceLinked,true);
 assert.equal(s.steps.find(q=>q.key==='customer')?.evidence,'review');
 assert.equal(s.steps.find(q=>q.key==='quote')?.evidence,'source');
});
test('crew source unavailable is an unknown, not a false empty assignment',()=>{
 const a=buildJobContinuity(data(),booking,{available:false,employeeName:null});
 const b=buildJobContinuity(data(),booking,{available:true,employeeName:null});
 assert.equal(a.steps.find(x=>x.key==='crew')?.evidence,'review');
 assert.match(a.steps.find(x=>x.key==='crew')!.detail,/unavailable/);
 assert.match(b.steps.find(x=>x.key==='crew')!.detail,/No actual employee assignment/);
});
test('projector is pure and retains distinct field and financial record states',()=>{
 const d=data(),before=JSON.stringify(d);
 const x=buildJobContinuity(d,booking,crew);
 assert.equal(JSON.stringify(d),before);
 assert.equal(x.steps.length,6);
 assert.equal(new Set(x.steps.map(v=>v.key)).size,6);
 assert.deepEqual(new Set(x.steps.map(v=>v.evidence)),new Set(['source','local-only','not-built']));
});
