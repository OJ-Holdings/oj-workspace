import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking} from '../src/lib/exterior';
import type {JobContinuitySnapshot} from '../src/lib/exterior-job-continuity';
import type {SharedJobFollowup} from '../src/lib/exterior-job-followup';
import {buildJobNextActions} from '../src/lib/exterior-job-next-actions';

const booking:ExtBooking={
 id:'11111111-1111-4111-8111-111111111111',
 lead_id:'22222222-2222-4222-8222-222222222222',
 date:'2026-10-30',time_block:'9-12',status:'confirmed',
};
const original={date:booking.date,time:booking.time_block,status:booking.status};
const view:JobContinuitySnapshot={
 bookingId:booking.id,leadId:booking.lead_id,sourceLinked:true,
 visitPrice:null,status:'confirmed',sourceCoverage:'complete',
 steps:[
  {key:'customer',title:'Customer',detail:'Unverified customer record',evidence:'review',route:'customer'},
  {key:'quote',title:'Quote',detail:'Visit quote unverified',evidence:'review',route:'estimate'},
  {key:'booking',title:'Booking',detail:'Confirmed time',evidence:'source',route:'bookings'},
  {key:'crew',title:'Crew',detail:'Employee unverified',evidence:'review',route:'bookings'},
  {key:'field',title:'Field',detail:'Private only',evidence:'local-only',route:'field'},
  {key:'payment',title:'Payment',detail:'Not connected',evidence:'not-built',route:'finance'},
 ],
};
const activeTask=(note:string):SharedJobFollowup=>({
 id:'33333333-3333-4333-8333-333333333333',
 title:'Internal task',assignee:'Jacob',stage:'In progress',priority:'high',
 dueDate:'',revision:1,createdAt:'',updatedAt:'',note,
 origin:'manual-job-task',handoffRequestId:null,
 sourceDate:booking.date,sourceTime:booking.time_block,sourceStatus:booking.status,
});
const check=(v:JobContinuitySnapshot=view,b:ExtBooking=booking,
 s=original,t:SharedJobFollowup[]=[],limited=false)=>buildJobNextActions(v,b,s,t,limited);

test('R47 uses exact current source and finite source gaps to draft internal work without approvals or payments',()=>{
 const result=check();
 assert.equal(result.state,'ready');
 assert.deepEqual(result.actions.map(a=>a.key),['customer','quote','crew']);
 assert.equal(result.actions[0].priority,'high');
 assert.ok(result.actions.every(a=>a.note.length>=10&&a.note.length<=1200));
 assert.ok(result.actions.every(a=>!a.note.includes('11111111')&&!a.note.includes('22222222')));
 assert.equal(result.actions.some(a=>a.note.includes('collected funds confirmed')),false);
 assert.equal(result.actions.some(a=>a.key==='payment'),false);
});

test('R47 pending booking first suggests approval only as internal review, not crew dispatch',()=>{
 const b={...booking,status:'pending_approval'};
 const v={...view,status:'pending' as const};
 const s={...original,status:'pending_approval'};
 const out=check(v,b,s);
 assert.deepEqual(out.actions.map(a=>a.key),['approval','customer','quote','crew']);
 assert.equal(out.actions[0].priority,'high');
 assert.match(out.actions[0].note,/before any crew dispatch/);
});
test('R47 invalid booking time appears as prioritized source correction',()=>{
 const v={...view,steps:view.steps.map(s=>s.key==='booking'?{...s,evidence:'review' as const}:s)};
 assert.equal(check(v).actions[0].key,'time');
});
test('R47 refuses stale, cancelled, unrelated, missing and partially loaded task source',()=>{
 assert.equal(check(view,{...booking,status:'cancelled'},{...original,status:'cancelled'}).state,'booking-inactive');
 assert.equal(check(view,booking,{...original,date:'2026-11-01'}).state,'source-stale');
 assert.equal(check({...view,bookingId:'not-original'}).state,'source-missing');
 assert.equal(check({...view,sourceLinked:false}).state,'source-missing');
 assert.equal(check(view,booking,original,[],true).state,'partial-team-source');
 for(const output of [
  check(view,{...booking,status:'cancelled'},{...original,status:'cancelled'}),
  check(view,booking,{...original,date:'2026-11-01'}),
  check({...view,bookingId:'not-original'}),
  check(view,booking,original,[],true),
 ])assert.deepEqual(output.actions,[]);
});
test('R47 recognizes an already-open same-source assignment regardless of whitespace and capitalization',()=>{
 const initial=check();
 const text=initial.actions[0].note;
 const existing=activeTask('  '+text.toUpperCase().replace(/ /g,'   ')+'  ');
 const result=check(view,booking,original,[existing]);
 assert.equal(result.actions[0].existing?.id,existing.id);
 assert.equal(result.actions[0].existing?.assignee,'Jacob');
 assert.equal(result.actions[1].existing,null);
 assert.equal(check(view,booking,original,[{...existing,stage:'Done'}]).actions[0].existing,null);
 assert.equal(check(view,booking,original,[{...existing,sourceDate:'2026-10-31'}]).actions[0].existing,null);
});
test('R47 does not infer that field work, invoices or payment exist from otherwise complete current sources',()=>{
 const steps=view.steps.map(s=>['customer','quote','crew'].includes(s.key)?{...s,evidence:'source' as const}:s);
 const x=check({...view,visitPrice:450,steps});
 assert.equal(x.state,'ready');
 assert.deepEqual(x.actions,[]);
 assert.equal(x.actions.some(a=>a.key==='payment'||a.key==='crew'),false);
});
test('R47 selection derivation is pure; neither source nor tasks are mutated',()=>{
 const b=JSON.stringify(booking),v=JSON.stringify(view);
 const task=activeTask('Check original booking details.');
 const saved=JSON.stringify(task);
 check(view,booking,original,[task]);
 assert.equal(JSON.stringify(booking),b);
 assert.equal(JSON.stringify(view),v);
 assert.equal(JSON.stringify(task),saved);
});
