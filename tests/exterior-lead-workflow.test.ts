import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExtLead } from '../src/lib/exterior';
import {
  countLeadWorkFocuses,leadWorkFocuses,leadWorkLabels,leadWorkDescriptions,
  matchesLeadWorkFocus,sortLeadsForWork,
} from '../src/lib/exterior-lead-workflow';

const make=(id:string,status:string|null,extra:Partial<ExtLead>={}):ExtLead=>({
  id,name:'Test Customer',phone:null,address:null,service_requested:null,
  quote_amount:null,status,source:'google',notes:null,job_revenue:null,
  job_cost:null,created_at:'2026-10-23T06:00:00.000Z',updated_at:null,
  completed_at:null,...extra,
});
test('all queue counts use only loaded exact source rows and recorded statuses',()=>{
  const rows=[
    make('new','new'),
    make('contact','contacted',{quote_amount:200}),
    make('following','following_up',{quote_amount:0}),
    make('booked','booked',{quote_amount:250}),
    make('completed','completed',{job_revenue:200,job_cost:null}),
    make('completed0','completed',{job_revenue:0,job_cost:0}),
    make('unknown',null),
  ];
  const counts=countLeadWorkFocuses(rows);
  assert.deepEqual(counts,{
    all:7,new:1,'follow-up':2,quoted:2,booked:1,'needs-accounting':1,
  });
  assert.equal(rows.every(x=>x.status===null||typeof x.status==='string'),true);
  assert.equal(counts.all,rows.length);
  assert.equal(leadWorkFocuses.length,6);
  assert.equal(leadWorkFocuses.every(key=>leadWorkLabels[key]&&leadWorkDescriptions[key]),true);
});

test('quotes are opportunities, not proof of acceptance, booking or cash',()=>{
  assert.equal(matchesLeadWorkFocus(make('a','following_up',{quote_amount:420}),'quoted'),true);
  assert.equal(matchesLeadWorkFocus(make('a','booked',{quote_amount:420}),'quoted'),false);
  assert.equal(matchesLeadWorkFocus(make('a','completed',{quote_amount:420,job_revenue:null}),'quoted'),false);
  assert.equal(matchesLeadWorkFocus(make('a','new',{quote_amount:null}),'quoted'),false);
});

test('complete with explicit zero collected and zero cost is not incorrectly marked missing',()=>{
  assert.equal(matchesLeadWorkFocus(make('a','completed',{job_revenue:0,job_cost:0}),'needs-accounting'),false);
  assert.equal(matchesLeadWorkFocus(make('a','completed',{job_revenue:null,job_cost:0}),'needs-accounting'),true);
  assert.equal(matchesLeadWorkFocus(make('a','completed',{job_revenue:100,job_cost:null}),'needs-accounting'),true);
  assert.equal(matchesLeadWorkFocus(make('a','booked',{job_revenue:null,job_cost:null}),'needs-accounting'),false);
});

test('follow-up stage is not invented from new, booked or completed source rows',()=>{
  assert.equal(matchesLeadWorkFocus(make('a','contacted'),'follow-up'),true);
  assert.equal(matchesLeadWorkFocus(make('b','following_up'),'follow-up'),true);
  for(const status of ['new','booked','completed','lost']){
    assert.equal(matchesLeadWorkFocus(make('x',status),'follow-up'),false);
  }
});

test('sorting only reflects actual source chronology, never inferred urgency or due times',()=>{
  const rows=[
    make('newer','following_up',{created_at:'2026-10-24T06:00:00.000Z'}),
    make('older','new',{created_at:'2026-10-01T06:00:00.000Z'}),
    make('tieB','booked',{created_at:'2026-10-21T06:00:00.000Z'}),
    make('tieA','completed',{created_at:'2026-10-21T06:00:00.000Z'}),
  ];
  const sorted=sortLeadsForWork(rows);
  assert.deepEqual(sorted.map(x=>x.id),['newer','tieA','tieB','older']);
  assert.deepEqual(rows.map(x=>x.id),['newer','older','tieB','tieA']);
});
