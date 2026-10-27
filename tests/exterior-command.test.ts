import assert from 'node:assert/strict';
import test from 'node:test';
import type {Card} from '../src/lib/board';
import type {ExteriorData,ExtLead} from '../src/lib/exterior';
import {buildExteriorCommand} from '../src/lib/exterior-command';

const lead=(id:string,status:string,quote_amount:number|null=null,job_revenue:number|null=null,job_cost:number|null=null,extra:Partial<ExtLead>={}):ExtLead=>({
  id,name:id,phone:null,address:'123 Example St',service_requested:'House wash',quote_amount,status,source:'lsa',
  notes:null,job_revenue,job_cost,created_at:'2026-10-22T20:00:00Z',
  updated_at:'2026-10-22T21:00:00Z',completed_at:null,...extra,
});
const card=(id:string,business:Card['business']='exterior',due_date=''):Card=>({
  id,organization_id:'org',title:'Inspect source '+id,description:'',business,stage:'Ready',
  priority:'normal',assignee:'Oscar',due_date,revision:0,checklist:[],
});
const data:ExteriorData={
  leads:[
    lead('new-quoted','new',350,null,null,{source:'LSA'}),
    lead('new-unpriced','new',null,null,null,{source:'dtd'}),
    lead('follow','following_up',260),
    lead('booked','booked',500),
    lead('job-matched','completed',225,225,45,{completed_at:'2026-10-19T13:00:00Z'}),
    lead('job-missing-cost','completed',400,400,null,{completed_at:'2026-09-18T13:00:00Z'}),
    lead('job-zero','completed',0,0,0,{completed_at:'2026-08-18T13:00:00Z'}),
  ],
  bookings:[
    {id:'booking-future',lead_id:'booked',date:'2026-10-26',time_block:'9-12',status:'confirmed'},
    {id:'booking-no-lead',lead_id:'not-loaded',date:'2026-10-27',time_block:null,status:'confirmed'},
    {id:'booking-past',lead_id:'booked',date:'2026-10-01',time_block:'9-12',status:'confirmed'},
    {id:'booking-denied',lead_id:'new-quoted',date:'2026-10-28',time_block:'9-12',status:'denied'},
  ],
  activity:[],sessions:[],
  extras:null,
  coverage:{
    leads:{loaded:7,total:12},bookings:{loaded:4,total:4},sessions:{loaded:0,total:0},
  },
};
test('money states remain distinct: pipeline, quoted booked, recorded job and complete-cost subset',()=>{
 const x=buildExteriorCommand(data,[],'2026-10-23');
 assert.equal(x.sales.open,3);
 assert.equal(x.sales.newRequests,2);
 assert.equal(x.sales.followingUp,1);
 assert.equal(x.sales.quotedOpenValue,610);
 assert.equal(x.sales.openUnpriced,1);
 assert.equal(x.dispatch.confirmedUpcoming,2);
 assert.equal(x.dispatch.quotedUpcomingValue,null, 'partial source cannot substantiate a visit-specific quoted total');
 assert.equal(x.dispatch.priced,0);
 assert.equal(x.dispatch.unpriced,2);
 assert.equal(x.production.completed,3);
 assert.equal(x.production.withRevenue,3);
 assert.equal(x.production.withCosts,2);
 assert.equal(x.production.fullyCosted,2);
 assert.equal(x.production.recordedJobRevenue,625);
 assert.equal(x.production.matchedContribution,180);
 assert.equal(x.production.estimatedCompletionDates,0);
 assert.equal(Object.prototype.hasOwnProperty.call(x.production,'collectedCash'),false);
});
test('unknown quote/revenue/cost never silently becomes zero or fake collected money',()=>{
 const d={...data,leads:[lead('unquoted','new'),lead('done','completed',null,null,null)],bookings:[]};
 const x=buildExteriorCommand(d,[],'2026-10-23');
 assert.equal(x.sales.quotedOpenValue,null);
 assert.equal(x.dispatch.quotedUpcomingValue,null);
 assert.equal(x.production.recordedJobRevenue,null);
 assert.equal(x.production.matchedContribution,null);
 assert.equal(x.months.every(m=>m.revenue===null),true);
});
test('source completeness is disclosed; missing linked lead cannot get a fake customer or price',()=>{
 const x=buildExteriorCommand(data,[],'2026-10-23');
 assert.equal(x.source.partial,true);
 assert.equal(x.source.leadCoverage,'7 of 12 source records loaded');
 assert.equal(x.source.bookingCoverage,'4 of 4 source records loaded');
 assert.ok(x.source.notes.some(m=>/outside the loaded/.test(m)));
 assert.ok(x.decisions.some(d=>d.id==='missing-customer'));
 assert.equal(x.dispatch.next[1].leadId,null);
 assert.equal(x.dispatch.next[1].quote,null);
 assert.equal(x.dispatch.next[0].quote,null, 'price is not attributable while lead source coverage is incomplete');
});
test('does not count denied/past bookings as upcoming, completed lead fields as bank transfers, or foreign tasks',()=>{
 const x=buildExteriorCommand(data,[
   card('due','exterior','2026-10-22'),
   {...card('today'),stage:'Review',due_date:'2026-10-23',assignee:''},
   card('future','exterior','2026-11-01'),
   card('other','solutions','2026-10-20'),
   {...card('done','exterior','2026-10-01'),stage:'Done'},
 ],'2026-10-23');
 assert.equal(x.dispatch.confirmedUpcoming,2);
 assert.equal(x.tasks.open,3);
 assert.equal(x.tasks.overdue,1);
 assert.equal(x.tasks.dueToday,1);
 assert.equal(x.tasks.unassigned,1);
 assert.ok(x.decisions.some(d=>d.id==='due-tasks'));
});
test('strict 6-month chart and only recorded monthly revenue; source tags are all-time counts',()=>{
 const x=buildExteriorCommand(data,[],'2026-10-23');
 assert.deepEqual(x.months.map(m=>m.key),['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
 assert.deepEqual(x.months.map(m=>m.revenue),[null,null,null,0,400,225]);
 assert.equal(x.sales.bySource[0].name,'Local Services Ads');
 assert.equal(x.sales.bySource[0].count,6);
 assert.equal(x.sales.bySource[1].name,'Door to door');
});
test('dates are validated rather than displaying unsupported financial periods',()=>{
 for(const bad of ['not-a-date','2026-02-30','2026-13-23','2026-10'])assert.throws(()=>buildExteriorCommand(data,[],bad));
 const x=buildExteriorCommand({...data,coverage:undefined},[],'2026-10-23');
 assert.equal(x.source.partial,false);
 assert.equal(x.source.leadCoverage,'Full-history coverage not reported');
});

test('full source with one active confirmed visit can show lead quote in command',()=>{
 const d:ExteriorData={...data,
  leads:[lead('a','booked',650)],
  bookings:[{id:'one',lead_id:'a',date:'2026-10-26',time_block:'9-12',status:'confirmed'}],
  coverage:{leads:{loaded:1,total:1},bookings:{loaded:1,total:1},sessions:{loaded:0,total:0}},
 };
 const x=buildExteriorCommand(d,[],'2026-10-23');
 assert.equal(x.dispatch.quotedUpcomingValue,650);
 assert.equal(x.dispatch.priced,1);
 assert.equal(x.dispatch.unpriced,0);
 assert.equal(x.dispatch.next[0].quote,650);
});
test('two visits for one lead never inflate the command quote or per-visit timeline',()=>{
 const d:ExteriorData={...data,
  leads:[lead('a','booked',650)],
  bookings:[
   {id:'one',lead_id:'a',date:'2026-10-26',time_block:'9-12',status:'confirmed'},
   {id:'repeat',lead_id:'a',date:'2026-10-28',time_block:'9-12',status:'confirmed'},
  ],
  coverage:{leads:{loaded:1,total:1},bookings:{loaded:2,total:2},sessions:{loaded:0,total:0}},
 };
 const x=buildExteriorCommand(d,[],'2026-10-23');
 assert.equal(x.dispatch.quotedUpcomingValue,null);
 assert.equal(x.dispatch.priced,0);
 assert.equal(x.dispatch.unpriced,2);
 assert.equal(x.dispatch.next.every(row=>row.quote===null),true);
});
