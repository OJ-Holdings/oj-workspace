import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtLead,ExtBooking,ExteriorData} from '../src/lib/exterior';
import {
 newExteriorEstimate,type ExteriorEstimate,
} from '../src/lib/exterior-estimate';
import {
 newP3QuoteLedger,appendP3QuoteVersion,appendP3AcceptanceClaim,
 preflightP3WorkOrder,type P3Identity,type P3OrderContext,
 type P3AcceptanceClaim,type P3Attestation,
} from '../src/lib/exterior-p3-workflow';

const ids={
 org:'00000000-0000-4000-8000-000000000001',
 org2:'00000000-0000-4000-8000-000000000002',
 customer:'10000000-0000-4000-8000-000000000001',
 customer2:'10000000-0000-4000-8000-000000000002',
 property:'20000000-0000-4000-8000-000000000001',
 property2:'20000000-0000-4000-8000-000000000002',
 lead:'30000000-0000-4000-8000-000000000001',
 opportunity:'40000000-0000-4000-8000-000000000001',
 quote:'50000000-0000-4000-8000-000000000001',
 booking:'60000000-0000-4000-8000-000000000001',
 booking2:'60000000-0000-4000-8000-000000000002',
 actor:'70000000-0000-4000-8000-000000000001',
 command:'80000000-0000-4000-8000-000000000001',
 command2:'80000000-0000-4000-8000-000000000002',
 command3:'80000000-0000-4000-8000-000000000003',
 version:'90000000-0000-4000-8000-000000000001',
 version2:'90000000-0000-4000-8000-000000000002',
 claim:'a0000000-0000-4000-8000-000000000001',
 claim2:'a0000000-0000-4000-8000-000000000002',
 receipt:'b0000000-0000-4000-8000-000000000001',
 order:'c0000000-0000-4000-8000-000000000001',
};
const time='2026-10-24T22:00:00.000Z';
const identity=(targetBookingId:string|null=ids.booking):P3Identity=>({
 organizationId:ids.org,customerId:ids.customer,propertyId:ids.property,
 legacyLeadId:ids.lead,opportunityId:ids.opportunity,quoteId:ids.quote,
 targetBookingId,
});
const lead=(overrides:Partial<ExtLead>={}):ExtLead=>({
 id:ids.lead,name:'Example Customer',phone:'+12625551234',
 address:'123 EXAMPLE ST',service_requested:'Window cleaning',
 quote_amount:225,status:'booked',source:'LSA',
 notes:'SECRET CUSTOMER NOTE DO NOT COPY',job_revenue:10000,job_cost:500,
 created_at:'2026-10-20T12:00:00.000Z',
 updated_at:'2026-10-22T18:00:00.000Z',completed_at:null,...overrides,
});
const booking=(overrides:Partial<ExtBooking>={}):ExtBooking=>({
 id:ids.booking,lead_id:ids.lead,date:'2026-11-04',
 time_block:'9-12',status:'confirmed',...overrides,
});
const data=(leads:ExtLead[]=[lead()],bookings:ExtBooking[]=[booking()]):ExteriorData=>({
 leads,bookings,sessions:[],activity:[],extras:null,
 coverage:{leads:{loaded:leads.length,total:leads.length},
  bookings:{loaded:bookings.length,total:bookings.length},
  sessions:{loaded:0,total:0}},
});
function draft(source=lead()):ExteriorEstimate{
 const base=newExteriorEstimate(source);
 return {...base,lines:[{
  id:'pane-1',service:'Office window cleaning',unit:'pane',quantity:20,
  pricePerUnit:11.75,costPerUnit:null,notes:'Exterior glass only',
 }],discount:10,travelCost:null,contingencyPct:7};
}
const versionCommand=(estimate=draft(),overrides:Record<string,unknown>={})=>({
 commandId:ids.command,expectedRevision:0,versionId:ids.version,
 actorId:ids.actor,occurredAt:time,estimate,...overrides,
});
const starting=()=>newP3QuoteLedger(identity());
const versioned=()=>appendP3QuoteVersion(starting(),lead(),versionCommand());
const claimCommand=(overrides:Record<string,unknown>={})=>({
 commandId:ids.command2,expectedRevision:1,claimId:ids.claim,
 versionId:ids.version,bookingId:ids.booking,
 actorId:ids.actor,occurredAt:time,kind:'operator-report' as const,
 reference:'Operator recalls a verbal yes; not independently checked',...overrides,
});
const link=()=>({
 organizationId:ids.org,customerId:ids.customer,propertyId:ids.property,
 legacyLeadId:ids.lead,
});
const proof=(thread=versioned(),overrides:Partial<P3Attestation>={}):P3Attestation=>{
 const v=thread.versions.at(-1)!;
 return {
  organizationId:ids.org,customerId:ids.customer,propertyId:ids.property,
  quoteId:ids.quote,versionId:v.id,bookingId:ids.booking,
  contentHash:v.contentHash,priceCents:v.priceCents,
  externalReceiptId:ids.receipt,verifiedAt:time,...overrides,
 };
};
const context=(thread=versioned(),overrides:Partial<P3OrderContext>={}):P3OrderContext=>({
 data:data(),booking:booking(),sourceLink:link(),
 acceptance:proof(thread),existingOrders:[],
 orderCoverage:{loaded:0,total:0},...overrides,
});
const blocked=(b:ReturnType<typeof preflightP3WorkOrder>,why:string)=>{
 assert.equal(b.eligible,false);
 assert.equal(b.candidate,null);
 assert.ok(b.blockers.includes(why as never),JSON.stringify(b.blockers));
};

test('P3 immutable quote v1 stores exact linked public scope, price cents and no proprietary costs',()=>{
 const source=lead(),original=draft(source);
 const json=JSON.stringify(original);
 const thread=appendP3QuoteVersion(starting(),source,versionCommand(original));
 assert.equal(thread.revision,1);
 assert.equal(thread.versions.length,1);
 const v=thread.versions[0];
 assert.equal(v.sequence,1);
 assert.equal(v.priceCents,22500);
 assert.equal(v.subtotalCents,23500);
 assert.equal(v.discountCents,1000);
 assert.equal(v.sourceQuoteCents,22500);
 assert.match(v.contentHash,/^[a-f0-9]{64}$/);
 assert.equal(v.scope[0].unit,'pane');
 assert.equal(v.scope[0].quantity,20);
 assert.equal(v.scope[0].unitPriceCents,1175);
 assert.equal(JSON.stringify(original),json);
 assert.equal('costPerUnit' in v.scope[0],false);
 assert.equal('travelCost' in v,false);
 assert.equal('job_revenue' in v,false);
 assert.equal('job_cost' in v,false);
 assert.equal(Object.isFrozen(v),true);
 assert.equal(Object.isFrozen(v.scope[0]),true);
 assert.equal(Object.isFrozen(thread.identity),true);
 original.lines[0].service='Edited after version save';
 assert.equal(v.scope[0].service,'Office window cleaning');
});

test('P3 command revision and idempotency guard duplicate retry and replay with altered content',()=>{
 const empty=starting(),cmd=versionCommand();
 const first=appendP3QuoteVersion(empty,lead(),cmd);
 assert.strictEqual(appendP3QuoteVersion(first,lead(),cmd),first);
 assert.equal(first.versions.length,1);
 assert.equal(first.commands[0].revision,1);
 assert.throws(()=>appendP3QuoteVersion(first,lead(),versionCommand(draft(),{
  versionId:ids.version2,commandId:ids.command2,
 })),/revision conflict/i);
 assert.throws(()=>appendP3QuoteVersion(first,lead(),versionCommand(draft(),{
  versionId:ids.version2,
 })),/reused with different content/i);
 assert.equal(empty.revision,0);
});

test('P3 disallows wrong lead, stale legacy source, wrong customer and invalid quote',()=>{
 const empty=starting();
 assert.throws(()=>appendP3QuoteVersion(empty,lead({id:ids.customer2}),versionCommand()),/original lead/i);
 assert.throws(()=>appendP3QuoteVersion(empty,lead({quote_amount:300}),versionCommand()),/source revision changed/i);
 assert.throws(()=>appendP3QuoteVersion(empty,lead({updated_at:time}),versionCommand()),/source revision changed/i);
 assert.throws(()=>appendP3QuoteVersion(empty,lead(),versionCommand({...draft(),discount:999})),/discount/i);
 assert.throws(()=>appendP3QuoteVersion(empty,lead(),versionCommand({...draft(),lines:[{...draft().lines[0],quantity:0}]})),/invalid lines/i);
 assert.throws(()=>newP3QuoteLedger({...identity(),customerId:'fake'}),/UUID/);
 assert.throws(()=>appendP3QuoteVersion(empty,lead(),versionCommand(draft(),{occurredAt:'yesterday'})),/UTC/);
});

test('P3 later versions are sequential immutable snapshots; first version is not rewritten',()=>{
 const first=versioned();
 const edit=draft();
 edit.lines[0].pricePerUnit=14.75;
 const second=appendP3QuoteVersion(first,lead(),versionCommand(edit,{
  commandId:ids.command2,expectedRevision:1,versionId:ids.version2,
 }));
 assert.equal(second.versions.length,2);
 assert.equal(second.versions[1].sequence,2);
 assert.equal(second.versions[1].priceCents,28500);
 assert.equal(first.versions[0].priceCents,22500);
 assert.equal(second.versions[0].priceCents,22500);
 assert.notEqual(second.versions[0].contentHash,second.versions[1].contentHash);
 assert.strictEqual(first.versions[0],second.versions[0]);
});

test('P3 acceptance claims are always unverified even when referencing a provider or a signature',()=>{
 const first=versioned();
 const claim=claimCommand({
  kind:'signed-document-reference',
  reference:'Private signed artifact reference—not a verified signature',
 });
 const next=appendP3AcceptanceClaim(first,claim);
 assert.equal(next.revision,2);
 assert.equal(next.acceptanceClaims.length,1);
 assert.equal(next.acceptanceClaims[0].verification,'unverified');
 assert.strictEqual(appendP3AcceptanceClaim(next,claim),next);
 assert.equal(next.versions.length,1);
 blocked(preflightP3WorkOrder(next,context(next,{acceptance:null})),'acceptance-unverified');
 assert.throws(()=>appendP3AcceptanceClaim(first,claimCommand({versionId:ids.version2})),/missing quote version/i);
 assert.throws(()=>appendP3AcceptanceClaim(first,claimCommand({reference:'bad\nreference'})),/single-line/i);
 assert.throws(()=>appendP3AcceptanceClaim(first,claimCommand({bookingId:ids.booking2})),/exact intended visit/i);
});

test('P3 emits only a transaction-ready candidate, never a persisted work order',()=>{
 const thread=versioned();
 const result=preflightP3WorkOrder(thread,context(thread));
 assert.equal(result.eligible,true);
 assert.deepEqual(result.blockers,[]);
 assert.equal(result.candidate?.status,'transaction-not-executed');
 assert.equal(result.candidate?.bookingId,ids.booking);
 assert.equal(result.candidate?.priceCents,22500);
 assert.equal(result.candidate?.quoteVersionHash,thread.versions[0].contentHash);
 assert.equal(result.candidate?.customerScope[0].service,'Office window cleaning');
 assert.equal(result.candidate?.externalAcceptanceReceiptId,ids.receipt);
 assert.equal('bankReceipt' in result.candidate!,false);
 assert.equal('jobCompleted' in result.candidate!,false);
 assert.equal('approved' in result.candidate!,false);
 assert.equal(Object.isFrozen(result.candidate),true);
});

test('P3 requires exact source and explicit canonical property/customer identity',()=>{
 const thread=versioned();
 blocked(preflightP3WorkOrder(thread,context(thread,{sourceLink:null})),'identity-not-linked');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  sourceLink:{...link(),propertyId:ids.property2},
 })),'identity-not-linked');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  sourceLink:{...link(),organizationId:ids.org2},
 })),'identity-not-linked');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  booking:booking({id:ids.booking2}),
 })),'booking-not-exact');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data([lead(),lead()]),
 })),'duplicate-source');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data([lead()],[booking(),booking()]),
 })),'duplicate-source');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:{...data(),coverage:undefined},
 })),'source-incomplete');
});

test('P3 rejects pending, cancelled, invalid time and superseded booking snapshots',()=>{
 const thread=versioned();
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data([lead()],[booking({status:'pending_approval'})]),
  booking:booking({status:'pending_approval'}),
 })),'booking-not-confirmed');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data([lead()],[booking({status:'cancelled'})]),
  booking:booking({status:'cancelled'}),
 })),'booking-not-confirmed');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data([lead()],[booking({time_block:'invalid'})]),
  booking:booking({time_block:'invalid'}),
 })),'booking-time-invalid');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data(),booking:booking({date:'2026-11-05'}),
 })),'booking-not-exact');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data(),booking:booking({lead_id:ids.customer2}),
 })),'booking-not-exact');
});

test('P3 rejects second visits unless opportunity has an exact booking identity',()=>{
 const other=booking({id:ids.booking2,date:'2026-11-11'});
 const thread=newP3QuoteLedger(identity(null));
 const q=appendP3QuoteVersion(thread,lead(),versionCommand());
 blocked(preflightP3WorkOrder(q,context(q,{
  data:data([lead()],[booking(),other]),
 })),'visit-ambiguous');
 const exact=versioned();
 assert.equal(preflightP3WorkOrder(exact,context(exact,{
  data:data([lead()],[booking(),other]),
 })).eligible,true);
 blocked(preflightP3WorkOrder(exact,context(exact,{
  data:data([lead()],[other]),
  booking:other,
 })),'visit-ambiguous');
});

test('P3 structurally binds acceptance to newest immutable version, amount, provider reference and booking',()=>{
 const one=versioned();
 const second=appendP3QuoteVersion(one,lead(),versionCommand(draft(),{
  commandId:ids.command2,expectedRevision:1,versionId:ids.version2,
 }));
 blocked(preflightP3WorkOrder(second,context(second,{
  acceptance:proof(one),
 })),'acceptance-version-mismatch');
 blocked(preflightP3WorkOrder(one,context(one,{
  acceptance:proof(one,{contentHash:'0'.repeat(64)}),
 })),'acceptance-version-mismatch');
 blocked(preflightP3WorkOrder(one,context(one,{
  acceptance:proof(one,{priceCents:1}),
 })),'acceptance-version-mismatch');
 blocked(preflightP3WorkOrder(one,context(one,{
  acceptance:proof(one,{organizationId:ids.org2}),
 })),'acceptance-version-mismatch');
 blocked(preflightP3WorkOrder(one,context(one,{
  acceptance:proof(one,{customerId:ids.customer2}),
 })),'acceptance-version-mismatch');
 blocked(preflightP3WorkOrder(one,context(one,{
  acceptance:proof(one,{externalReceiptId:'not-uuid'}),
 })),'acceptance-version-mismatch');
 blocked(preflightP3WorkOrder(one,context(one,{
  acceptance:proof(one,{verifiedAt:'fake'}),
 })),'acceptance-version-mismatch');
});

test('P3 work-order preflight refuses unknown order coverage and duplicate booking orders',()=>{
 const thread=versioned();
 blocked(preflightP3WorkOrder(thread,context(thread,{orderCoverage:null})),
  'workorder-source-incomplete');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  orderCoverage:{loaded:0,total:null},
 })),'workorder-source-incomplete');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  orderCoverage:{loaded:1,total:1},existingOrders:[],
 })),'workorder-source-incomplete');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  orderCoverage:{loaded:1,total:1},
  existingOrders:[{organizationId:ids.org,workOrderId:ids.order,
   bookingId:ids.booking,quoteVersionId:ids.version}],
 })),'workorder-already-exists');
});

test('P3 source price drift cannot be hidden by a structurally valid attestation',()=>{
 const thread=versioned();
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data([lead({updated_at:'2026-10-25T10:00:00.000Z'})]),
 })),'quote-source-stale');
 blocked(preflightP3WorkOrder(thread,context(thread,{
  data:data([lead({quote_amount:350})]),
 })),'quote-source-stale');
});

test('P3 event IDs and quote content signatures remain isolated by opportunity and organization',()=>{
 const base=versioned();
 const other=newP3QuoteLedger({...identity(),organizationId:ids.org2});
 const next=appendP3QuoteVersion(other,lead(),versionCommand());
 assert.notEqual(base.versions[0].contentHash,next.versions[0].contentHash);
 const c=appendP3AcceptanceClaim(base,claimCommand());
 assert.equal(c.commands.length,2);
 assert.equal(c.acceptanceClaims[0].recordedBy,ids.actor);
 assert.equal(c.acceptanceClaims[0].versionId,ids.version);
 assert.equal(c.acceptanceClaims[0].verification,'unverified');
 assert.equal(base.acceptanceClaims.length,0);
 const example=P3ClaimGuardForTest(c.acceptanceClaims[0]);
 assert.equal(example,'unverified');
});
function P3ClaimGuardForTest(claim:P3AcceptanceClaim){
 return claim.verification;
}
