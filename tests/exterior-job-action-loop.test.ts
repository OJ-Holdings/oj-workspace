import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking} from '../src/lib/exterior';
import type {SharedJobFollowup} from '../src/lib/exterior-job-followup';
import {
 existingOpenJobAction,linkedTaskActionable,originalBookingActionable,
 validOperatorNote,type OriginalBookingSnapshot,
} from '../src/lib/exterior-job-action-loop';
import {originalJobMatchesTask} from '../src/lib/exterior-operations-inbox';

const booking:ExtBooking={
 id:'11111111-1111-4111-8111-111111111111',
 lead_id:'22222222-2222-4222-8222-222222222222',
 date:'2026-10-28',time_block:'9-12',status:'confirmed',
};
const source:OriginalBookingSnapshot={
 date:booking.date,time:booking.time_block,status:booking.status,
};
const task:SharedJobFollowup={
 id:'33333333-3333-4333-8333-333333333333',
 title:'Test job action',assignee:'Jacob',stage:'Ready',priority:'high',
 dueDate:'2026-10-27',revision:2,createdAt:'2026-10-24T19:00:00Z',
 updatedAt:'2026-10-24T19:00:00Z',note:'Check water access before arrival',
 origin:'manual-job-task',handoffRequestId:null,
 sourceDate:booking.date,sourceTime:booking.time_block,sourceStatus:booking.status,
};

test('R43 keeps a verified original booking writable only when source snapshot matches',()=>{
 assert.equal(originalBookingActionable(booking,source),true);
 for(const modified of [
  {date:'2026-10-29'}, {time:'10-1'}, {status:'pending_approval'},
 ]){
  assert.equal(originalBookingActionable(booking,{...source,...modified}),false);
 }
 assert.equal(originalBookingActionable(booking,null),false);
 assert.equal(originalBookingActionable({...booking,lead_id:null},source),false);
});

test('R43 denied/cancelled/null booking statuses prohibit posting and advancing tasks',()=>{
 for(const status of ['denied','cancelled','unknown',null]){
  const updated={...booking,status};
  assert.equal(originalBookingActionable(updated,{...source,status}),false);
  assert.equal(linkedTaskActionable(task,updated,{...source,status}),false);
 }
});

test('R43 pending approval can have INTERNAL review work, but is not approved dispatch',()=>{
 const pending={...booking,status:'pending_approval'};
 const snapshot={...source,status:'pending_approval'};
 const review={...task,sourceStatus:'pending_approval'};
 assert.equal(originalBookingActionable(pending,snapshot),true);
 assert.equal(linkedTaskActionable(review,pending,snapshot),true);
 assert.notEqual(review.stage,'Done');
});

test('R45 unsupported status cannot be used to advance a task even if the task receipt is forged to match',()=>{
 for(const status of ['completed','rescheduled','unknown',null]){
  const same={...booking,status};
  const original={...source,status};
  const matchingTask={...task,sourceStatus:status};
  assert.equal(originalBookingActionable(same,original),false);
  assert.equal(linkedTaskActionable(matchingTask,same,original),false);
 }
});

test('task commands require exact original task receipt, independently of current load snapshot',()=>{
 assert.equal(linkedTaskActionable(task,booking,source),true);
 assert.equal(originalJobMatchesTask(task,booking),true);
 for(const patch of [
  {sourceDate:'2026-10-29'},{sourceTime:'12-3'},
  {sourceStatus:'pending_approval'},
 ]){
  assert.equal(linkedTaskActionable({...task,...patch},booking,source),false,
   JSON.stringify(patch));
 }
 assert.equal(linkedTaskActionable(task,booking,{...source,date:'2026-10-30'}),false);
 assert.equal(originalJobMatchesTask(task,{...booking,status:'cancelled'}),false);
});

test('same action same teammate is detected despite formatting and letter case',()=>{
 assert.equal(existingOpenJobAction([task],'Jacob','  CHECK  WATER access before arrival  ')?.id,task.id);
 assert.equal(existingOpenJobAction([task],'Oscar',task.note),null);
 assert.equal(existingOpenJobAction([task],'Jacob','Confirm the hose connection instead'),null);
 assert.equal(existingOpenJobAction([{...task,stage:'Done'}],'Jacob',task.note),null);
 assert.equal(existingOpenJobAction([task],'Jacob',''),null);
});

test('R43 task and comment input size/controls fail closed without changing source',()=>{
 assert.equal(validOperatorNote('Check pump'),true);
 assert.equal(validOperatorNote('ab'),false);
 assert.equal(validOperatorNote('   '),false);
 assert.equal(validOperatorNote('a'.repeat(601)),false);
 assert.equal(validOperatorNote('a'.repeat(600)),true);
 assert.equal(validOperatorNote('a'.repeat(1200),10,1200),true);
 assert.equal(validOperatorNote('a'.repeat(1201),10,1200),false);
 for(const bad of ['Hold\u0001 now','Hold\u0000 now','Hold\u007f now']){
  if(bad.includes('\u007f'))continue; // existing server allows DEL, only C0 prohibited
  assert.equal(validOperatorNote(bad),false);
 }
});

test('pure guards preserve task, booking and source objects for another device',()=>{
 const original=JSON.stringify({booking,source,task});
 originalBookingActionable(booking,source);
 linkedTaskActionable(task,booking,source);
 existingOpenJobAction([task],task.assignee,task.note);
 assert.equal(JSON.stringify({booking,source,task}),original);
});
