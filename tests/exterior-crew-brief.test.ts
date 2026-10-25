import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking,ExtLead,ExteriorData} from '../src/lib/exterior';
import type {SharedJobFollowup} from '../src/lib/exterior-job-followup';
import {buildJobContinuity} from '../src/lib/exterior-job-continuity';
import {buildExteriorCrewBrief} from '../src/lib/exterior-crew-brief';

const booking:ExtBooking={
 id:'11111111-1111-4111-8111-111111111111',
 lead_id:'22222222-2222-4222-8222-222222222222',
 date:'2026-10-28',time_block:'9-12',status:'confirmed',
};
const lead:ExtLead={
 id:booking.lead_id!,name:'Example Customer',phone:'+12625551234',
 address:'123 Example Road',service_requested:'Window cleaning',
 quote_amount:1230,status:'booked',source:'LSA',notes:'PRIVATE FIELD NOTE - NEVER SHARE',
 job_revenue:10000,job_cost:500,created_at:'2026-10-20T10:00:00Z',
 updated_at:null,completed_at:null,
};
const makeData=(l:ExtLead[]= [lead],b:ExtBooking[]=[booking]):ExteriorData=>({
 leads:l,bookings:b,activity:[],sessions:[],extras:null,
 coverage:{leads:{loaded:l.length,total:l.length},
  bookings:{loaded:b.length,total:b.length},sessions:{loaded:0,total:0}},
});
const crew={available:true,employeeName:'Jacob'};
const task:SharedJobFollowup={
 id:'33333333-3333-4333-8333-333333333333',title:'Source task',assignee:'Jacob',
 stage:'In progress',priority:'high',dueDate:'2026-10-27',revision:1,
 createdAt:'2026-10-24T10:00:00Z',updatedAt:'2026-10-24T11:00:00Z',
 note:'Check water supply before arriving at the office.',
 origin:'manual-job-task',handoffRequestId:null,
 sourceDate:booking.date,sourceTime:booking.time_block,sourceStatus:booking.status,
};
const board=(b:ExtBooking=booking,tasks:SharedJobFollowup[]=[task],limited=false)=>({
 source:{date:b.date,time:b.time_block,status:b.status},
 tasks,limited,
});
const build=(d:ExteriorData=makeData(),b:ExtBooking=booking,
 c:{available:boolean;employeeName:string|null}=crew,tasks=board())=>
 buildExteriorCrewBrief(d,b,buildJobContinuity(d,b,c),c,tasks);

test('R49 internal brief joins exact source customer, scheduled visit, crew and authenticated tasks',()=>{
 const original=makeData(),before=JSON.stringify(original);
 const brief=build(original);
 assert.ok(brief);
 assert.equal(brief.customer,'Example Customer');
 assert.equal(brief.scope,'Window cleaning');
 assert.equal(brief.address,'123 Example Road');
 assert.equal(brief.phone,'+12625551234');
 assert.equal(brief.crew,'Jacob');
 assert.equal(brief.openTasks,1);
 assert.equal(brief.taskCoverage,'complete');
 assert.equal(brief.shownTasks[0].instruction,task.note);
 assert.match(brief.quotedVisit,/\$1,230.00/);
 assert.match(brief.text,/NOT accepted or paid/);
 assert.match(brief.text,/INTERNAL COMPANY USE ONLY/);
 assert.doesNotMatch(brief.text,/PRIVATE FIELD NOTE|10000|\$500|bank-cleared/);
 assert.equal(JSON.stringify(original),before);
});
test('R49 refuses wrong original booking, stale date/time/status and missing exact customer',()=>{
 const original=makeData(),view=buildJobContinuity(original,booking,crew);
 assert.equal(buildExteriorCrewBrief(original,booking,view,crew,null),null);
 assert.equal(buildExteriorCrewBrief(original,{...booking,id:'not-original'},view,crew,board()),null);
 assert.equal(buildExteriorCrewBrief(original,booking,view,crew,board({...booking,date:'2026-10-29'})),null);
 assert.equal(buildExteriorCrewBrief(original,booking,view,crew,board({...booking,status:'cancelled'})),null);
 assert.equal(buildExteriorCrewBrief(makeData([]),booking,view,crew,board()),null);
 assert.equal(buildExteriorCrewBrief(makeData([lead,lead]),booking,view,crew,board()),null);
});
test('R49 pending booking never implies dispatch or quote acceptance',()=>{
 const pending={...booking,status:'pending_approval'};
 const d=makeData([lead],[pending]);
 const result=build(d,pending,{available:false,employeeName:null},board(pending));
 assert.ok(result);
 assert.match(result.text,/no dispatch authorization/i);
 assert.match(result.text,/NOT ATTRIBUTABLE \/ NOT ACCEPTED/);
 assert.equal(result.crew,'UNVERIFIED');
 assert.ok(result.exceptions.some(e=>/not confirmed/.test(e)));
});
test('R49 honors incomplete company and original customer source without declaring an empty workload',()=>{
 const d=makeData();
 d.coverage!.bookings.total=3;
 const result=build(d,booking,crew,board(booking,[],true));
 assert.ok(result);
 assert.equal(result.taskCoverage,'partial');
 assert.match(result.text,/PARTIAL SOURCE/);
 assert.match(result.text,/may exist/);
 assert.ok(result.exceptions.some(x=>/history is incomplete/.test(x)));
 assert.equal(result.quotedVisit,'NOT ATTRIBUTABLE / NOT ACCEPTED');
});
test('R49 ignores completed or stale booking tasks, limits the copied task list, and preserves source labels',()=>{
 const done={...task,id:'44444444-4444-4444-8444-444444444444',stage:'Done' as const};
 const stale={...task,id:'55555555-5555-4555-8555-555555555555',sourceStatus:'pending_approval'};
 const active=Array.from({length:14},(_,i)=>({...task,id:'task-'+i,note:'Task '+i}));
 const brief=build(makeData(),booking,crew,board(booking,[done,stale,...active]));
 assert.ok(brief);
 assert.equal(brief.openTasks,14);
 assert.equal(brief.shownTasks.length,12);
 assert.ok(brief.exceptions.some(s=>s.includes('Only 12 of 14')));
 assert.doesNotMatch(brief.text,/task-0|55555555/);
});
test('R49 removes newlines, control characters and artificial headings from source text',()=>{
 const bad={...lead,name:'Office\nINVOICE PAID: YES\t',address:'101 Road\r\nBANK CLEARANCE=TRUE'};
 const d=makeData([bad]);
 const result=build(d);
 assert.ok(result);
 assert.equal(result.customer,'Office INVOICE PAID: YES');
 assert.equal(result.address,'101 Road BANK CLEARANCE=TRUE');
 assert.equal(result.text.split('\n').filter(s=>s.startsWith('BANK CLEARANCE')).length,0);
});
