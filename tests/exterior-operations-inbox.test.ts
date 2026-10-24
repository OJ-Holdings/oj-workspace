import test from 'node:test';
import assert from 'node:assert/strict';
import type {Card} from '../src/lib/board';
import type {ExtBooking,ExtLead} from '../src/lib/exterior';
import {
 buildExteriorOperationsInbox,inboxTiming,originalJobMatchesTask,
 selectExteriorInbox,
} from '../src/lib/exterior-operations-inbox';
import {makeJobFollowupCard,parseJobFollowupReceipt} from '../src/lib/exterior-job-followup';

const org='11111111-1111-4111-8111-111111111111';
const alienOrg='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const a='22222222-2222-4222-8222-222222222222';
const b='33333333-3333-4333-8333-333333333333';
const c='44444444-4444-4444-8444-444444444444';
const d='55555555-5555-4555-8555-555555555555';
const la='66666666-6666-4666-8666-666666666666';
const lb='77777777-7777-4777-8777-777777777777';
const lc='88888888-8888-4888-8888-888888888888';
const ld='99999999-9999-4999-8999-999999999999';
const ta='01234567-89ab-4cde-8fab-123456789012';
const tb='01234567-89ab-4cde-8fab-123456789013';
const tc='01234567-89ab-4cde-8fab-123456789014';
const td='01234567-89ab-4cde-8fab-123456789015';
const today='2026-10-23';
const booking=(id:string,lead_id:string,date='2026-10-25',status:string|null='confirmed'):ExtBooking=>
 ({id,lead_id,date,time_block:'9-12',status});
const lead=(id:string,name:string):ExtLead=>({
 id,name,phone:'+12625550000',address:'1 Example Street',service_requested:'House wash',
 quote_amount:325,status:'booked',source:'LSA',notes:null,
 job_revenue:null,job_cost:null,created_at:'2026-10-19T10:00:00Z',
 updated_at:null,completed_at:null,
});
const memberCard=(id:string,job:ExtBooking,extra:Partial<Card>={},dueOn='2026-10-25'):Card=>{
 const x=makeJobFollowupCard(org,job,{
  taskId:id,leadId:job.lead_id!,
  sourceDate:job.date,sourceTime:job.time_block,sourceStatus:job.status,
  assignee:'Jacob',note:'Call the customer and confirm clear water access before starting.',
  dueOn,priority:'normal',origin:'manual-job-task',handoffRequestId:null,
 });
 return {...x,...extra};
};
const sourceBookings=[
 booking(a,la),booking(b,lb),booking(c,lc),booking(d,ld),
];
const customers=[
 lead(la,'Cedar Property'),lead(lb,'Birch House'),
 lead(lc,'Maple Office'),lead(ld,'Oak Villa'),
];
const build=(tasks:Card[],jobs=sourceBookings,people=customers,member='Jacob',matches=1,count:number|null=tasks.length)=>
 buildExteriorOperationsInbox(org,tasks,jobs,people,member,matches,today,count);

test('source-qualified member task work contains original booking customer and no payment state',()=>{
 const task=memberCard(ta,sourceBookings[0]);
 const report=build([task]);
 assert.equal(report.items.length,1);
 assert.equal(report.identity,'unique');
 assert.equal(report.myName,'Jacob');
 assert.equal(report.totals.active,1);
 assert.equal(report.totals.mine,1);
 assert.equal(report.totals.overdue,0);
 assert.equal(report.partial,false);
 const item=report.items[0];
 assert.equal(item.customer,'Cedar Property');
 assert.equal(item.service,'House wash');
 assert.equal(item.bookingId,a);
 assert.equal(item.leadId,la);
 assert.equal(item.source,'current');
 assert.equal(item.isMine,true);
 assert.equal(item.isOpen,true);
 assert.equal(item.timing,'future');
 assert.equal(item.task.note,'Call the customer and confirm clear water access before starting.');
 for(const forbidden of ['invoice','paid','completedJob','actualCrewHours','customerApproval'])
  assert.equal(Object.hasOwn(item,forbidden),false);
});
test('overdue, review, source drift and today classifications sort by action priority',()=>{
 const tasks=[
  memberCard(ta,sourceBookings[0],{priority:'high'},'2026-10-29'),
  memberCard(tb,sourceBookings[1],{stage:'Review'},'2026-10-24'),
  memberCard(tc,sourceBookings[2],{},'2026-10-23'),
  memberCard(td,sourceBookings[3],{},'2026-10-19'),
 ];
 const report=build(tasks);
 assert.deepEqual(report.items.map(x=>x.task.id),[td,tb,tc,ta]);
 assert.equal(report.totals.active,4);
 assert.equal(report.totals.overdue,1);
 assert.equal(report.totals.review,1);
 assert.equal(report.totals.dueToday,1);
 assert.equal(report.totals.highPriority,1);
 assert.deepEqual(selectExteriorInbox(report.items,'overdue').map(x=>x.task.id),[td]);
 assert.deepEqual(selectExteriorInbox(report.items,'review').map(x=>x.task.id),[tb]);
 assert.deepEqual(selectExteriorInbox(report.items,'today').map(x=>x.task.id),[tc]);
});
test('a changed booking takes highest priority and is not treated as current source',()=>{
 const t=memberCard(ta,sourceBookings[0]);
 const changed=booking(a,la,'2026-10-26');
 const report=build([t],[changed]);
 assert.equal(report.items[0].source,'changed');
 assert.equal(report.items[0].actualBookingDate,'2026-10-26');
 assert.equal(report.totals.sourceChanged,1);
 assert.equal(report.items[0].sourceDetail.includes('changed'),true);
 assert.equal(originalJobMatchesTask(t as unknown as {sourceDate:string;sourceTime:string|null;sourceStatus:string|null},changed),false);
 const receipt=parseJobFollowupReceipt(t.description)!;
 assert.equal(originalJobMatchesTask({
  sourceDate:receipt.sourceDate,sourceTime:receipt.sourceTime,sourceStatus:receipt.sourceStatus,
 },changed),false);
 assert.equal(selectExteriorInbox(report.items,'source-changed').length,1);
});
test('cancelled/denied booking is never an actively valid source for a task',()=>{
 const t=memberCard(ta,sourceBookings[0]);
 for(const status of ['cancelled','denied']){
  const record={...sourceBookings[0],status};
  const report=build([t],[record]);
  assert.equal(report.items[0].source,'changed');
  assert.equal(report.totals.sourceChanged,1);
 }
});
test('no booking or a mismatched lead becomes source unavailable without made-up customer info',()=>{
 const t=memberCard(ta,sourceBookings[0]);
 let report=build([t],[],customers);
 assert.equal(report.items[0].source,'unavailable');
 assert.equal(report.items[0].customer,'Source customer unavailable');
 assert.equal(report.items[0].actualBookingDate,null);
 report=build([t],[{...sourceBookings[0],lead_id:lb}],customers);
 assert.equal(report.items[0].source,'unavailable');
 report=build([t],[sourceBookings[0]],[]);
 assert.equal(report.items[0].source,'unavailable');
});
test('other company tasks and arbitrary text cannot forge inbox memberships',()=>{
 const good=memberCard(ta,sourceBookings[0]);
 const alien={...good,organization_id:alienOrg,id:tb};
 const unrelated={...good,id:tc,description:'Regular team task, not a booking receipt'};
 const general={...good,id:td,business:'solutions' as const};
 const report=build([good,alien,unrelated,general]);
 assert.equal(report.items.length,1);
 assert.equal(report.items[0].task.id,ta);
 assert.equal(report.scannedCount,1);
 assert.equal(report.returnedCount,4);
});
test('Done is only task status; it cannot be overdue and disappears from active filters',()=>{
 const done=memberCard(ta,sourceBookings[0],{stage:'Done'},'2026-10-19');
 const report=build([done]);
 assert.equal(report.items[0].isOpen,false);
 assert.equal(report.items[0].timing,'none');
 assert.equal(report.totals.active,0);
 assert.equal(report.totals.mine,0);
 assert.equal(report.totals.overdue,0);
 assert.equal(selectExteriorInbox(report.items,'mine').length,0);
 assert.equal(selectExteriorInbox(report.items,'all').length,1);
});
test('the Mine filter requires an unambiguous active member identity',()=>{
 const card=memberCard(ta,sourceBookings[0]);
 const unique=build([card],sourceBookings,customers,'Jacob',1);
 const ambiguous=build([card],sourceBookings,customers,'Jacob',2);
 const unknown=build([card],sourceBookings,customers,'Other',0);
 assert.equal(unique.totals.mine,1);
 assert.equal(ambiguous.totals.mine,0);
 assert.equal(ambiguous.identity,'ambiguous');
 assert.equal(ambiguous.myName,null);
 assert.equal(unknown.identity,'unknown');
 assert.equal(unknown.totals.mine,0);
 assert.equal(selectExteriorInbox(ambiguous.items,'mine').length,0);
});
test('partial and unknown source page counts never imply all company tasks are loaded',()=>{
 const card=memberCard(ta,sourceBookings[0]);
 assert.equal(build([card],sourceBookings,customers,'Jacob',1,4).partial,true);
 assert.equal(build([card],sourceBookings,customers,'Jacob',1,null).partial,true);
 assert.equal(build([card],sourceBookings,customers,'Jacob',1,1).partial,false);
 const noTasks=build([],[],[],'Jacob',1,0);
 assert.equal(noTasks.totals.active,0);
 assert.equal(noTasks.partial,false);
});
test('due date is classified by source business date, never current browser timezone',()=>{
 assert.equal(inboxTiming('2026-10-22',today,false),'overdue');
 assert.equal(inboxTiming(today,today,false),'today');
 assert.equal(inboxTiming('2026-10-24',today,false),'future');
 assert.equal(inboxTiming('',today,false),'none');
 assert.equal(inboxTiming('2026-10-22',today,true),'none');
 assert.equal(inboxTiming('2026-02-30',today,false),'none');
 assert.throws(()=>buildExteriorOperationsInbox(org,[],[],[],'Jacob',1,'2026-02-30',0));
});
test('sorting keeps incomplete receipts out without mutating the task source',()=>{
 const original=memberCard(ta,sourceBookings[0]);
 const taskData=[original];
 const saved=JSON.stringify({taskData,sourceBookings,customers});
 const report=build(taskData);
 assert.equal(report.items.length,1);
 assert.equal(JSON.stringify({taskData,sourceBookings,customers}),saved);
 const sorted=selectExteriorInbox(report.items,'all');
 assert.notStrictEqual(sorted,report.items);
 assert.equal(sorted[0].task.id,ta);
});
