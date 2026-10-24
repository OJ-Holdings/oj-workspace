import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking} from '../src/lib/exterior';
import {
 allowedFollowupStages,buildJobFollowupDescription,isJobFollowupFor,
 makeJobFollowupCard,parseJobFollowupReceipt,projectJobFollowup,
 validateJobFollowup,type NewJobFollowup,
} from '../src/lib/exterior-job-followup';

const org='11111111-1111-4111-8111-111111111111';
const otherOrg='99999999-9999-4999-8999-999999999999';
const bookingId='22222222-2222-4222-8222-222222222222';
const leadId='33333333-3333-4333-8333-333333333333';
const taskId='44444444-4444-4444-8444-444444444444';
const requestId='55555555-5555-4555-8555-555555555555';
const booking:ExtBooking={
 id:bookingId,lead_id:leadId,date:'2026-10-26',time_block:'9-12',status:'confirmed',
};
const input=(x:Partial<NewJobFollowup>={}):NewJobFollowup=>({
 taskId,leadId,sourceDate:booking.date,sourceTime:booking.time_block,
 sourceStatus:booking.status,assignee:'Jacob',
 note:'Verify hose coupling, retest pump, and report outcome to both founders.',
 dueOn:'2026-10-27',priority:'high',origin:'manual-job-task',
 handoffRequestId:null,...x,
});

test('R37 makes a real board card with no fake job or cash state',()=>{
 const result=makeJobFollowupCard(org,booking,input());
 assert.equal(result.id,taskId);
 assert.equal(result.organization_id,org);
 assert.equal(result.business,'exterior');
 assert.equal(result.stage,'Ready');
 assert.equal(result.revision,0);
 assert.equal(result.priority,'high');
 assert.equal(result.assignee,'Jacob');
 assert.equal(result.due_date,'2026-10-27');
 assert.equal(result.checklist.length,0);
 assert.ok(result.description.includes('INTERNAL SHARED COMPANY TASK'));
 for(const forbidden of ['jobCompleted','invoiceId','amountPaid','customerAccepted','payrollApproved'])
  assert.equal(Object.hasOwn(result,forbidden),false);
});
test('strict exact original company, booking and lead IDs bound to editable task description',()=>{
 const task=makeJobFollowupCard(org,booking,input());
 const receipt=parseJobFollowupReceipt(task.description);
 assert.ok(receipt);
 assert.deepEqual(receipt,{
  organizationId:org,bookingId,leadId,
  sourceDate:'2026-10-26',sourceTime:'9-12',sourceStatus:'confirmed',
  origin:'manual-job-task',handoffRequestId:null,
  note:input().note,
 });
 assert.equal(isJobFollowupFor(task.description,org,bookingId,leadId),true);
 assert.equal(isJobFollowupFor(task.description,otherOrg,bookingId,leadId),false);
 assert.equal(isJobFollowupFor(task.description,org,bookingId,otherOrg),false);
 assert.equal(isJobFollowupFor(task.description,org,taskId,leadId),false);
});
test('private owner reply can be referenced without claiming authenticated reviewer identity',()=>{
 const x=input({origin:'private-owner-reply-reference',handoffRequestId:requestId});
 const task=makeJobFollowupCard(org,booking,x);
 const receipt=parseJobFollowupReceipt(task.description);
 assert.equal(receipt?.handoffRequestId,requestId);
 assert.equal(receipt?.origin,'private-owner-reply-reference');
 assert.equal(task.description.includes('private costs:'),false);
 assert.equal(task.description.includes('reviewed_by:'),false);
 assert.throws(()=>validateJobFollowup(org,booking,
  input({origin:'private-owner-reply-reference',handoffRequestId:null})),/request identifier/);
 assert.throws(()=>validateJobFollowup(org,booking,
  input({origin:'manual-job-task',handoffRequestId:requestId})),/cannot claim/);
});
test('stale original dates, slots, status and inactive appointments fail closed',()=>{
 for(const change of [
  {sourceDate:'2026-10-27'},
  {sourceTime:'12-3'},
  {sourceStatus:'pending_approval'},
 ]){
  assert.throws(()=>validateJobFollowup(org,booking,input(change)),/changed/);
 }
 assert.throws(()=>validateJobFollowup(org,{...booking,status:'denied'},
  input({sourceStatus:'denied'})),/no longer active/);
 assert.throws(()=>validateJobFollowup(org,{...booking,status:'cancelled'},
  input({sourceStatus:'cancelled'})),/no longer active/);
 assert.throws(()=>validateJobFollowup(org,{...booking,status:null},
  input({sourceStatus:null})),/no longer active/);
});
test('missing, malformed and cross-record IDs cannot create a linked task',()=>{
 for(const wrong of [
  {taskId:'not-a-uuid'}, {leadId:'some-other-id'},
  {sourceDate:'not-a-date'},
 ]){
  assert.throws(()=>makeJobFollowupCard(org,booking,input(wrong)));
 }
 assert.throws(()=>makeJobFollowupCard(otherOrg,{...booking,lead_id:taskId},input()));
 assert.throws(()=>makeJobFollowupCard('none',booking,input()));
});
test('task guidance requires meaningful, bounded, non-control-character content',()=>{
 for(const bad of ['', 'Too short', 'x'.repeat(1201),'hi\0there123']){
  assert.throws(()=>makeJobFollowupCard(org,booking,input({note:bad})));
 }
 assert.throws(()=>makeJobFollowupCard(org,booking,input({dueOn:'2026-02-30'})),/date/);
 assert.throws(()=>makeJobFollowupCard(org,booking,input({assignee:'\nOscar'})),/member/);
 assert.throws(()=>makeJobFollowupCard(org,booking,input({assignee:''})),/member/);
 assert.throws(()=>makeJobFollowupCard(org,booking,input({priority:'urgent' as 'normal'})),/urgency/);
 assert.deepEqual(validateJobFollowup(org,booking,input({note:'  Check hoses first.  '})).note,'Check hoses first.');
});
test('booking source cannot inject extra receipt lines via time/status',()=>{
 assert.throws(()=>makeJobFollowupCard(org,
  {...booking,time_block:'9-12\nOrganization ID: forged'},
  input({sourceTime:'9-12\nOrganization ID: forged'})),/safely formatted/);
 assert.throws(()=>makeJobFollowupCard(org,
  {...booking,status:'confirmed\r\nExterior lead ID: forged'},
  input({sourceStatus:'confirmed\r\nExterior lead ID: forged'})),/safely formatted/);
});
test('receipt parser rejects forged scope and unauthorized-like status markers',()=>{
 const valid=makeJobFollowupCard(org,booking,input());
 for(const changed of [
  valid.description.replace('OJ_EXTERIOR_JOB_FOLLOWUP_V1','SOME_OTHER_TASK'),
  valid.description.replace('Organization ID: '+org,'Organization ID: some-random-org'),
  valid.description.replace('Exterior booking ID: '+bookingId,'Exterior booking ID: missing'),
  valid.description.replace('Origin: manual-job-task','Origin: customer-paid'),
  valid.description.replace('Local handoff request: NONE','Local handoff request: '+requestId),
  valid.description.replace('ACTION:\n','NO ACTION MARKER\n'),
  valid.description.replace('Source booking day: 2026-10-26','Source booking day: 2026-02-30'),
 ]){
  assert.equal(parseJobFollowupReceipt(changed),null);
 }
});
test('member-editable description is a scope hint and never a certified foreign key',()=>{
 const source=makeJobFollowupCard(org,booking,input());
 const projected=projectJobFollowup({
  ...source,created_at:'2026-10-26T15:00:00Z',updated_at:'2026-10-26T15:00:00Z',
 },org,bookingId,leadId);
 assert.ok(projected);
 assert.equal(projected.sourceDate,'2026-10-26');
 assert.equal(projected.sourceTime,'9-12');
 assert.equal(projected.sourceStatus,'confirmed');
 assert.equal(projected.note,input().note);
 assert.equal(projected.origin,'manual-job-task');
 assert.equal(projected.handoffRequestId,null);
 assert.equal(projected.stage,'Ready');
 assert.equal(projectJobFollowup({...source,organization_id:otherOrg},org,bookingId,leadId),null);
 assert.equal(projectJobFollowup({...source,business:'solutions'},org,bookingId,leadId),null);
 assert.equal(projectJobFollowup({...source,description:'A normal company task'},org,bookingId,leadId),null);
});
test('follow-up stages only describe tasks, not customer job completion',()=>{
 assert.deepEqual(allowedFollowupStages,['Ready','In progress','Review','Done']);
 assert.equal(allowedFollowupStages.includes('Backlog' as 'Ready'),false);
 const task=makeJobFollowupCard(org,booking,input());
 assert.equal(task.stage,'Ready');
 assert.equal(parseJobFollowupReceipt(task.description)?.note,input().note);
 assert.equal(task.description.includes('not proof of completed work'),true);
});
test('private notes can contain ordinary newline text without creating extra trusted receipts',()=>{
 const n='Check the fitting.\nCall the customer when the new coupling is installed.';
 const t=makeJobFollowupCard(org,booking,input({note:n}));
 assert.equal(parseJobFollowupReceipt(t.description)?.note,n);
 assert.equal(isJobFollowupFor(t.description,org,bookingId,leadId),true);
});
test('original receipt parser refuses oversized or absent task bodies',()=>{
 assert.equal(parseJobFollowupReceipt('bad'),null);
 assert.equal(parseJobFollowupReceipt('x'.repeat(8001)),null);
 assert.equal(parseJobFollowupReceipt(null),null);
 assert.equal(parseJobFollowupReceipt({}),null);
 assert.equal(buildJobFollowupDescription(org,booking,input()).length<8000,true);
});
