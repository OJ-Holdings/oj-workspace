import assert from 'node:assert/strict';
import test from 'node:test';
import type {ExtBooking,ExtLead} from '../src/lib/exterior';
import {addLocalRevision,newExteriorEstimate,type LocalEstimateBook} from '../src/lib/exterior-estimate';
import {
  exportQuoteHandoff,importQuoteHandoff,quoteHandoffFormat,quoteHandoffVersion,
  quoteHandoffMaxChars,quoteHandoffPreflight,
} from '../src/lib/exterior-quote-handoff';

const org='00000000-0000-4000-8000-000000000001',otherOrg='00000000-0000-4000-8000-000000000002';
const leadId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222';
const lead=(extra:Partial<ExtLead>={}):ExtLead=>({
 id:leadId,name:'Customer Example',phone:'+12625550123',address:'123 Main St',
 service_requested:'Window cleaning',quote_amount:225,status:'new',source:'website',notes:null,
 job_revenue:null,job_cost:null,created_at:'2026-10-20T12:00:00Z',
 updated_at:'2026-10-23T19:00:00.000Z',completed_at:null,...extra,
});
const book=():LocalEstimateBook=>{
 const first=newExteriorEstimate(lead());
 const estimate={...first,lines:[
  {id:'l1',service:'Window washing',quantity:20,unit:'pane' as const,pricePerUnit:10,costPerUnit:3,notes:'Water access needed'},
  {id:'l2',service:'Walkway cleaning',quantity:1,unit:'flat' as const,pricePerUnit:25,costPerUnit:null,notes:''},
 ],travelCost:null,discount:0,contingencyPct:10};
 return addLocalRevision({schema:1,current:estimate,revisions:[]},'2026-10-23T19:50:00.000Z','r1');
};
test('portable internal quote transfers exact customer, versioned lines and null cost without approving the customer',()=>{
 const original=book();
 const raw=exportQuoteHandoff(org,original,new Date('2026-10-23T20:00:00.000Z'));
 const imported=importQuoteHandoff(raw,org,leadId);
 assert.equal(imported.format,quoteHandoffFormat);
 assert.equal(imported.version,quoteHandoffVersion);
 assert.equal(imported.organization_id,org);
 assert.equal(imported.lead_id,leadId);
 assert.equal(imported.status,'internal-draft');
 assert.deepEqual(imported.book,original);
 assert.equal(imported.book.current.travelCost,null);
 assert.equal(imported.book.current.lines[1].costPerUnit,null);
 assert.equal('customerApproved' in imported,false);
 assert.equal('invoiceId' in imported,false);
 assert.equal('signature' in imported,false);
});
test('wrong organization or customer lead ID is rejected without import fallback',()=>{
 const raw=exportQuoteHandoff(org,book());
 assert.throws(()=>importQuoteHandoff(raw,otherOrg,leadId),/different organization/i);
 assert.throws(()=>importQuoteHandoff(raw,org,otherId),/different customer record/i);
 assert.throws(()=>importQuoteHandoff(raw,org,''),/exact destination/i);
});
test('unknown statuses, new versions, malformed dates and oversized JSON are rejected',()=>{
 const base=JSON.parse(exportQuoteHandoff(org,book()));
 const mutate=(patch:(v:any)=>void,pattern:RegExp)=>{
  const cloned=structuredClone(base);patch(cloned);
  assert.throws(()=>importQuoteHandoff(JSON.stringify(cloned),org,leadId),pattern);
 };
 mutate(v=>{v.status='accepted'},/unsupported customer acceptance/i);
 mutate(v=>{v.version=2},/unsupported quote handoff/i);
 mutate(v=>{v.exported_at='2026-02-30T22:00:00.000Z'},/valid UTC timestamp/i);
 mutate(v=>{v.book.revisions[0].savedAt='not-a-date'},/valid UTC timestamp/i);
 mutate(v=>{v.book.revisions[0].estimate.discount=1000},/discount/i);
 mutate(v=>{v.book.current.lines[0].costPerUnit=-1},/invalid scope/i);
 mutate(v=>{v.book.current.leadId=otherId},/invalid scope/i);
 mutate(v=>{v.book.revisions[0].id=v.book.revisions[0].id;v.book.revisions.push(v.book.revisions[0])},/duplicate/i);
 assert.throws(()=>importQuoteHandoff('X'.repeat(quoteHandoffMaxChars+1),org,leadId),/120 KB/i);
 assert.throws(()=>importQuoteHandoff('{broken',org,leadId),/not valid JSON/i);
});
test('unknown fields cannot introduce customer approval, executable instructions or cross-scope identifiers',()=>{
 const bad=JSON.parse(exportQuoteHandoff(org,book()));
 bad.status='internal-draft';bad.approvedAt='2026-10-23T20:00:00.000Z';
 bad.externalMessageSent=true;
 bad.book.evilObject={run:'send customer invoice'};
 bad.book.current.sourceCustomerId=otherId;
 bad.book.current.lines[0].tamperedTax=777;
 bad.book.revisions[0].estimate.lines[0].taxTreatment='paid';
 const result=importQuoteHandoff(JSON.stringify(bad),org,leadId);
 assert.deepEqual(Object.keys(result).sort(),['book','exported_at','format','lead_id','organization_id','status','version']);
 assert.equal('approvedAt' in result,false);
 assert.equal('evilObject' in result.book,false);
 assert.equal('sourceCustomerId' in result.book.current,false);
 assert.equal('tamperedTax' in result.book.current.lines[0],false);
 assert.equal('taxTreatment' in result.book.revisions[0].estimate.lines[0],false);
});
test('preflight never fabricates approval or booking, even when price matches',()=>{
 const d=book().current,l=lead();
 const result=quoteHandoffPreflight(d,l,[]);
 assert.equal(result.sourceMatch,true);
 assert.equal(result.sourcePriceMatch,true);
 assert.equal(result.canRecordSharedPrice,true);
 assert.equal(result.linkedBookingCount,0);
 assert.equal(result.hasLinkedBooking,false);
 assert.equal(result.externalCustomerAcceptance,'unverified');
 assert.ok(result.warnings.some(s=>/unknown/i.test(s)));
 assert.ok(result.warnings.some(s=>/acceptance/i.test(s)));
});
test('preflight detects stale source, different price, booked status and exact-booking relationships',()=>{
 const d=book().current;
 const booking:ExtBooking={id:'b',lead_id:leadId,date:'2026-10-26',time_block:'9-12',status:'confirmed'};
 const wrong:ExtBooking={...booking,id:'other',lead_id:otherId};
 const result=quoteHandoffPreflight(d,lead({updated_at:'2026-10-24T00:00:00.000Z',quote_amount:300,status:'booked'}),[wrong,booking]);
 assert.equal(result.sourceMatch,false);
 assert.equal(result.sourcePriceMatch,false);
 assert.equal(result.canRecordSharedPrice,false);
 assert.equal(result.linkedBookingCount,1);
 assert.equal(result.hasLinkedBooking,true);
 assert.equal(result.externalCustomerAcceptance,'unverified');
});
test('all fields are cloned into the interchange so later local edits cannot mutate the parsed record',()=>{
 const original=book(),before=exportQuoteHandoff(org,original);
 const p=importQuoteHandoff(before,org,leadId);
 original.current.lines[0].notes='changed after export';
 assert.equal(p.book.current.lines[0].notes,'Water access needed');
});
