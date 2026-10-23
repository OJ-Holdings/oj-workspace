import assert from 'node:assert/strict';
import test from 'node:test';
import type {ExtLead,ExtQuote,ExteriorData} from '../src/lib/exterior';
import {matchingExteriorLeadCandidates,reviewExteriorWebsiteIntake,websiteRequestLeadDraft} from '../src/lib/exterior-intake-review';

const makeLead=(id:string,phone:string|null,address:string|null,name='Taylor'):ExtLead=>({
 id,name,phone,address,service_requested:'House wash',quote_amount:250,status:'booked',source:'dtd',
 notes:null,job_revenue:null,job_cost:null,created_at:'2026-10-01T12:00:00Z',
 updated_at:null,completed_at:null,
});
const makeRequest=(id:string,patch:Partial<ExtQuote>={}):ExtQuote=>({
 id,name:'Taylor',phone:'(262) 555-0102',email:'taylor@example.com',
 address:'100 Oak Street, Kenosha WI 53140',service_needed:'Window Cleaning',
 description:'Please wash south windows and avoid the flower beds.',
 property_type:'Commercial',business_name:'Example Co',recurring_interest:true,
 created_at:'2026-10-23T12:00:00Z',...patch,
});
const data:ExteriorData={
 leads:[
  makeLead('lead-phone','+12625550102','A completely different street', 'Unrelated named person'),
  makeLead('lead-address','2625550199','100 Oak Street, Kenosha WI 53140','Other tenant'),
  makeLead('lead-both','(262)555-0102','100 Oak Street, Kenosha WI 53140','Business partner'),
  makeLead('lead-name','(414)555-0109','Another Street, Milwaukee WI 53211','Taylor'),
  makeLead('lead-no-phone','NO_PHONE_1',null,'Taylor'),
 ],bookings:[],activity:[],sessions:[],
 extras:{goal:null,quotes:[makeRequest('req-old',{created_at:'2026-09-01T10:00:00Z'}),makeRequest('req-new')],upgrades:{},settings:{}},
};
test('matches exact US phone and sufficiently specific normalized address as candidates only',()=>{
 const hits=matchingExteriorLeadCandidates(makeRequest('request'),data.leads);
 assert.deepEqual(hits.map(x=>[x.id,x.on]),[
  ['lead-both','phone-and-address'],
  ['lead-phone','phone'],
  ['lead-address','address'],
 ]);
 assert.ok(!hits.some(x=>x.id==='lead-name'||x.id==='lead-no-phone'));
});
test('website requests make real lead drafts without fabricating quote value or settlement status',()=>{
 const {draft,notesTruncated}=websiteRequestLeadDraft(makeRequest('exact-req-1'));
 assert.equal(notesTruncated,false);
 assert.equal(draft.id,undefined);
 assert.equal(draft.source,'website');
 assert.equal(draft.name,'Taylor');
 assert.equal(draft.phone,'(262) 555-0102');
 assert.equal(draft.address,'100 Oak Street, Kenosha WI 53140');
 assert.equal(draft.service_requested,'Window Cleaning');
 assert.equal(draft.quote_amount,null);
 assert.match(draft.notes,/Website request source ID: exact-req-1/);
 assert.match(draft.notes,/Original received:/);
 assert.match(draft.notes,/taylor@example.com/);
 assert.match(draft.notes,/Recurring interest: yes/);
 assert.match(draft.notes,/Original request description:/);
 assert.match(draft.notes,/No client approval, estimate, payment or source-link claim/);
});
test('unavailable phone/name is not silently treated as a valid saved lead',()=>{
 const [row]=reviewExteriorWebsiteIntake({...data,extras:{...data.extras!,quotes:[makeRequest('missing',{name:null,business_name:null,phone:null})]}});
 assert.equal(row.readyForLeadDraft,false);
 assert.equal(row.draft.name,'');
 assert.equal(row.draft.phone,'');
 assert.equal(row.matches.length,1); // address may still be a possible match
});
test('truncated lengthy notes retain source reference and clearly refer to complete request',()=>{
 const huge=makeRequest('big-web',{description:'X'.repeat(12_000)});
 const {draft,notesTruncated}=websiteRequestLeadDraft(huge);
 assert.equal(notesTruncated,true);
 assert.ok(draft.notes.length<=4000);
 assert.match(draft.notes,/Website request source ID: big-web/);
 assert.match(draft.notes,/Additional request details remain in the original website inquiry/);
 assert.equal(draft.quote_amount,null);
});
test('inquiries remain sourced: sorting does not mark processed or merge lead identity',()=>{
 const rows=reviewExteriorWebsiteIntake(data);
 assert.deepEqual(rows.map(x=>x.request.id),['req-new','req-old']);
 assert.ok(rows.every(x=>x.matches.length===3));
 assert.ok(rows.every(x=>x.draft.id===undefined));
 assert.ok(!('processed' in rows[0]));
 assert.ok(!('linkedLeadId' in rows[0]));
 assert.ok(!('approvedPrice' in rows[0]));
});
test('short or placeholder addresses and phones never become identity proof',()=>{
 const r=makeRequest('req',{phone:'NP_1234',address:'Main St'});
 const x=matchingExteriorLeadCandidates(r,[makeLead('other','NP_1234','Main St','Taylor')]);
 assert.deepEqual(x,[]);
});
test('website source unavailable does not silently produce a synthetic inbox',()=>{
 assert.deepEqual(reviewExteriorWebsiteIntake({...data,extras:null}),[]);
});
