import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking,ExtLead} from '../src/lib/exterior';
import type {DispatchPreflightRow} from '../src/lib/exterior-dispatch-preflight';
import {
 dispatchAssignmentDueDay,dispatchAssignmentOptions,
 dispatchAssignmentPriority,eligibleDispatchAssignment,suggestDispatchAssignment,
} from '../src/lib/exterior-dispatch-delegation';

const bookId='22222222-2222-4222-8222-222222222222';
const leadId='33333333-3333-4333-8333-333333333333';
const book:ExtBooking={id:bookId,lead_id:leadId,date:'2026-10-26',time_block:'9-12',status:'confirmed'};
const lead:ExtLead={id:leadId,name:'Private test lead',phone:'+12625550000',
 address:'PRIVATE ADDRESS TO NEVER PUT IN TEAM TASK',service_requested:'House wash',
 quote_amount:325,status:'booked',source:'LSA',notes:'PRIVATE CUSTOMER NOTES',
 job_revenue:0,job_cost:null,created_at:'2026-10-22',updated_at:null,completed_at:null,
};
const makeRow=(x:Partial<DispatchPreflightRow>={}):DispatchPreflightRow=>({
 id:bookId,leadId,date:'2026-10-26',time:'9:00 AM–12:00 PM',
 status:'confirmed',customer:'Private customer',service:'House wash',
 address:lead.address,phone:lead.phone,quotedVisitAmount:325,
 findings:[
  {code:'site-address',level:'blocker',label:'Service address missing.',destination:'customer'},
  {code:'overlap',level:'attention',label:'Time overlaps another source booking; verify crew/rig capacity.',destination:'bookings'},
  {code:'quote-identity',level:'attention',label:'Quote needs attribution.',destination:'estimate'},
 ],isConfirmed:true,hasTimeOverlap:true,...x,
});

test('R41 binds dispatch work to exact original booking and customer identity',()=>{
 const row=makeRow();
 assert.equal(eligibleDispatchAssignment(row,book,lead),true);
 for(const bad of [
  {row:{id:'unrelated'}}, {row:{leadId:'wrong'}},
  {row:{date:'2026-10-27'}}, {row:{status:'pending_approval'}},
  {booking:{id:'wrong'}}, {booking:{lead_id:'other'}},
  {booking:{date:'2026-10-28'}}, {booking:{status:'denied'}},
  {booking:{status:'cancelled'}}, {booking:{status:null}},
  {lead:{id:'another'}},
 ]){
  assert.equal(eligibleDispatchAssignment(
   makeRow(bad.row),
   bad.booking?{...book,...bad.booking}:book,
   bad.lead?{...lead,...bad.lead}:lead,
  ),false,JSON.stringify(bad));
 }
 assert.equal(eligibleDispatchAssignment(row,undefined,lead),false);
 assert.equal(eligibleDispatchAssignment(row,book,undefined),false);
 assert.equal(eligibleDispatchAssignment(makeRow({findings:[]}),book,lead),false);
});
test('pending approval may get an INTERNAL review action but not presumed approval',()=>{
 const pendingBook={...book,status:'pending_approval'};
 const pendingRow=makeRow({status:'pending_approval',findings:[{
  code:'pending-approval',level:'blocker',
  label:'Booking awaits explicit source approval.',destination:'bookings',
 }]});
 assert.equal(eligibleDispatchAssignment(pendingRow,pendingBook,lead),true);
 const note=suggestDispatchAssignment(pendingRow,'pending-approval')!;
 assert.match(note,/verify.*approval/i);
 assert.doesNotMatch(note,/is approved|accepted the proposal|customer was contacted/i);
});
test('source-qualified suggestions are specific actions, never facts or private PII',()=>{
 const row=makeRow();
 for(const code of ['site-address','overlap','quote-identity']){
  const note=suggestDispatchAssignment(row,code);
  assert.ok(note&&note.length>=10&&note.length<1200);
  assert.ok(note.startsWith('Dispatch follow-up:'));
  for(const privateText of [lead.name!,lead.address!,lead.phone!,lead.notes!,'$325']){
   assert.equal(note.includes(privateText),false,code);
  }
 }
 assert.equal(suggestDispatchAssignment(row,'not-an-issue'),null);
 assert.equal(suggestDispatchAssignment(makeRow({findings:[]}), 'site-address'),null);
 assert.equal(suggestDispatchAssignment(row,'contact'),null);
});
test('options mirror exactly the currently detected exception codes',()=>{
 const row=makeRow();
 assert.deepEqual(dispatchAssignmentOptions(row).map(x=>x.code),
  ['site-address','overlap','quote-identity']);
 assert.equal(dispatchAssignmentOptions(makeRow({findings:[]})).length,0);
 assert.deepEqual(dispatchAssignmentOptions(makeRow({findings:[{
  code:'unexpected-payload',level:'blocker',label:'Do not use unvalidated code',destination:'bookings',
 }]})),[]);
});
test('blockers default to immediate attention; nonblockers to the visit date',()=>{
 const row=makeRow();
 assert.equal(dispatchAssignmentPriority(row,'site-address'),'high');
 assert.equal(dispatchAssignmentPriority(row,'overlap'),'normal');
 assert.equal(dispatchAssignmentDueDay(row,'site-address','2026-10-24'),'2026-10-24');
 assert.equal(dispatchAssignmentDueDay(row,'overlap','2026-10-24'),'2026-10-26');
 assert.equal(dispatchAssignmentDueDay(row,'overlap','2026-10-27'),'2026-10-27');
 assert.equal(dispatchAssignmentPriority(row,'missing-issue'),'normal');
 assert.equal(dispatchAssignmentDueDay(row,'missing-issue','2026-10-24'),'2026-10-24');
});
test('creating suggestions and eligibility checks never mutate source records',()=>{
 const row=makeRow(),original=JSON.stringify({row,book,lead});
 eligibleDispatchAssignment(row,book,lead);
 dispatchAssignmentOptions(row);
 suggestDispatchAssignment(row,'site-address');
 dispatchAssignmentPriority(row,'site-address');
 dispatchAssignmentDueDay(row,'overlap','2026-10-24');
 assert.equal(JSON.stringify({row,book,lead}),original);
});
