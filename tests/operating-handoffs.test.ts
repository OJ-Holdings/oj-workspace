import assert from 'node:assert/strict';
import test from 'node:test';
import { exactBookingReferences, followUpFromCrmLead, followUpFromExteriorBooking } from '../src/lib/operating-handoffs';
import { buildOperatingNetwork } from '../src/lib/operating-network';
import type { JobItem } from '../src/app/workspace/exterior-actions';
import type { Card } from '../src/lib/board';
const job=(id:string,status:string|null='scheduled',date='2026-10-23'):JobItem=>({
  id,lead_id:'legacy-'+id,date,time_block:'9 AM',status,
  name:'Sample Customer',service:'Commercial Window Cleaning',
  address:'Private Test Address',quote:325,
});
const task=(id:string,description:string,business:Card['business']='exterior'):Card=>({
  id,organization_id:'test-org',title:'Task '+id,description,
  business,stage:'Ready',priority:'normal',assignee:'Jacob',
  due_date:'',revision:0,checklist:[],
});

test('CRM handoff creates a draft with actual venture and ID but no contact disclosure',()=>{
  const draft=followUpFromCrmLead({id:'crm-42',venture:'solutions',name:'A customer',
    contact:'private phone',stage:'Proposal',value:2500,source:'import',
    notes:'private extra',created_at:'2026-10-22T12:00:00Z'},'/workspace');
  assert.equal(draft.business,'solutions');
  assert.equal(draft.due_date,'');
  assert.match(draft.title,/Follow up: A customer/);
  assert.match(draft.description,/\/workspace\/crm\?lead=crm-42/);
  assert.doesNotMatch(draft.description,/private phone|2500|private extra/);
  assert.match(draft.description,/draft/);
});

test('booking handoff carries exact identifier and date without amount or contact',()=>{
  const draft=followUpFromExteriorBooking(job('booking-7'),'/workspace');
  assert.equal(draft.business,'exterior');
  assert.equal(draft.due_date,'2026-10-23');
  assert.match(draft.description,/Booking record ID: booking-7/);
  assert.match(draft.description,/\/workspace\/b\/exterior\/leads\?lead=legacy-booking-7/);
  assert.doesNotMatch(draft.description,/325|Private Test Address/);
  assert.deepEqual(exactBookingReferences(draft.description),['booking-7']);
});

test('task handoff immediately creates exact connected operations relation once saved',()=>{
  const b=job('booking-7');
  const draft=followUpFromExteriorBooking(b,'/workspace');
  const result=buildOperatingNetwork({today:'2026-10-22',jobs:[b],
    dashboard:null,cards:[task('t1',draft.description)]});
  assert.equal(result.relations.length,2);
  assert.ok(result.relations.some(r=>r.fromKey==='task:t1'&&r.toKey==='booking:booking-7'));
  assert.ok(result.relations.some(r=>r.fromKey==='booking:booking-7'&&r.toKey===null));
});

test('booking relation rejects unavailable, inactive, mismatched-business, or fuzzy links',()=>{
  const b=job('7');
  const description=followUpFromExteriorBooking(b,'/workspace').description;
  const unrelated=[
    task('t1','Booking record ID: 7','solutions'),
    task('t2','Customer 7 window work'),
    task('t3','Booking record ID: missing'),
  ];
  const result=buildOperatingNetwork({today:'2026-10-22',jobs:[b],dashboard:null,cards:unrelated});
  assert.equal(result.relations.filter(r=>r.toKey==='booking:7').length,0);
  const inactive=buildOperatingNetwork({today:'2026-10-22',jobs:[job('7','cancelled')],
    dashboard:null,cards:[task('t4',description)]});
  assert.equal(inactive.relations.length,0);
});

test('inactive or malformed bookings fail closed before creating a task draft',()=>{
  for(const status of ['denied','cancelled']){
    assert.throws(()=>followUpFromExteriorBooking(job('x',status),'/workspace'));
  }
  assert.throws(()=>followUpFromExteriorBooking(job('x','scheduled','2026-02-30'),'/workspace'));
});

test('invalid reference and external base cannot become a cross-tenant link',()=>{
  assert.deepEqual(exactBookingReferences('Booking record ID: safe\nBooking record ID: safe\nBooking record ID: <bad>'),['safe']);
  const draft=followUpFromExteriorBooking(job('g'), 'https://other.example/evil');
  assert.match(draft.description,/\/workspace\/b\/exterior\/calendar/);
  assert.doesNotMatch(draft.description,/other.example/);
});
