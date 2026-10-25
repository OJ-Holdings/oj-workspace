import {createHash} from 'node:crypto';
import type {ExtBooking,ExtLead,ExteriorData} from './exterior';
import {
 computeExteriorEstimate,isExteriorEstimate,sourceStillMatches,
 type ExteriorEstimate,type EstimateUnit,
} from './exterior-estimate';
import {isValidBlock} from './exterior-ops';
import {validDay} from './exterior-job-followup';

/**
 * P3 contract engine v1. No SQL or production mutations.
 *
 * It is safe to execute on the SERVER for preview/dry-run and in tests.
 * The future database adapter MUST enforce the same invariants atomically
 * with RLS, unique constraints, immutable quote rows and verified receipts.
 * A plain object named "attestation" is NOT proof that a provider verified it.
 */
const uuid=/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const validId=(v:unknown):v is string=>typeof v==='string'&&uuid.test(v);
const time=(v:unknown):v is string=>typeof v==='string'&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&
 Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
const copyText=(s:string,max:number)=>s.trim().replace(/\s+/g,' ').slice(0,max);
function assert(condition:unknown,message:string):asserts condition{
 if(!condition)throw new Error(message);
}
const safeId=(v:unknown,label:string)=>{
 assert(validId(v),label+' must have a valid UUID.');
 return v;
};
const cents=(v:number)=>{
 assert(Number.isFinite(v)&&v>=0&&v<=10000000,'Quote money is out of supported range.');
 return Math.round((v+Number.EPSILON)*100);
};
export type P3Identity={
 organizationId:string;customerId:string;propertyId:string;
 legacyLeadId:string;opportunityId:string;quoteId:string;
 /** Identifies one exact visit. Null is allowed only for an unambiguous single visit. */
 targetBookingId:string|null;
};
export type P3PublicLine={
 id:string;service:string;unit:EstimateUnit;quantity:number;
 unitPriceCents:number;notes:string;
};
export type P3QuoteVersion={
 id:string;sequence:number;quoteId:string;organizationId:string;
 createdAt:string;createdBy:string;legacyLeadId:string;
 sourceUpdatedAt:string|null;sourceQuoteCents:number|null;
 subtotalCents:number;discountCents:number;priceCents:number;
 /** Immutable customer-visible scope. Never includes costPerUnit/travelCost. */
 scope:readonly Readonly<P3PublicLine>[];
 /** Binds organization, quote, visit, source revision, scope and price. */
 contentHash:string;
};
export type P3AcceptanceClaim={
 id:string;versionId:string;bookingId:string|null;
 kind:'operator-report'|'provider-reference'|'signed-document-reference';
 reference:string;createdAt:string;recordedBy:string;
 verification:'unverified';
};
export type P3CommandRecord={id:string;signature:string;revision:number};
export type P3QuoteLedger={
 identity:Readonly<P3Identity>;revision:number;
 versions:readonly P3QuoteVersion[];
 acceptanceClaims:readonly P3AcceptanceClaim[];
 commands:readonly P3CommandRecord[];
};
export type P3CreateVersion={
 commandId:string;expectedRevision:number;versionId:string;
 actorId:string;occurredAt:string;estimate:ExteriorEstimate;
};
export type P3ClaimAcceptance={
 commandId:string;expectedRevision:number;claimId:string;
 versionId:string;bookingId:string|null;actorId:string;occurredAt:string;
 kind:P3AcceptanceClaim['kind'];reference:string;
};
export type P3Attestation={
 /**
  * INPUT CONTRACT ONLY. The future trusted provider adapter must validate the
  * originating signature/receipt OUTSIDE this pure engine before supplying it.
  * NEVER construct this from a browser "approved" checkbox or user text.
  */
 organizationId:string;quoteId:string;versionId:string;
 customerId:string;propertyId:string;bookingId:string;
 priceCents:number;contentHash:string;
 externalReceiptId:string;verifiedAt:string;
};
export type P3ExistingOrder={
 organizationId:string;workOrderId:string;bookingId:string;quoteVersionId:string;
};
export type P3SourceLink={
 organizationId:string;customerId:string;propertyId:string;legacyLeadId:string;
};
export type P3OrderContext={
 data:ExteriorData;booking:ExtBooking;sourceLink:P3SourceLink|null;
 acceptance:P3Attestation|null;
 /** Complete query over existing canonical work orders; null count is unknown. */
 existingOrders:readonly P3ExistingOrder[];
 orderCoverage:{loaded:number;total:number|null}|null;
};
export type P3OrderBlocker=
 'source-incomplete'|'identity-not-linked'|'duplicate-source'|'booking-not-exact'|
 'booking-not-confirmed'|'booking-time-invalid'|'visit-ambiguous'|
 'quote-version-missing'|'quote-source-stale'|'acceptance-unverified'|
 'acceptance-version-mismatch'|'workorder-source-incomplete'|'workorder-already-exists';
export type P3OrderCandidate={
 /** Deliberately NOT an authorized work order. Only future DB transaction can create it. */
 status:'transaction-not-executed';
 organizationId:string;customerId:string;propertyId:string;legacyLeadId:string;
 opportunityId:string;quoteId:string;quoteVersionId:string;
 quoteVersionHash:string;priceCents:number;bookingId:string;
 bookingDate:string;bookingTimeBlock:string;
 customerScope:readonly P3PublicLine[];externalAcceptanceReceiptId:string;
};
export type P3OrderPreflight={
 eligible:boolean;blockers:readonly P3OrderBlocker[];
 candidate:P3OrderCandidate|null;
};

const frozen=<T>(v:T):T=>Object.freeze(v);
function freezeLedger(v:P3QuoteLedger):P3QuoteLedger{
 frozen(v.identity);
 v.versions.forEach(version=>{version.scope.forEach(frozen);frozen(version.scope);frozen(version);});
 v.acceptanceClaims.forEach(frozen);
 v.commands.forEach(frozen);
 frozen(v.versions);frozen(v.acceptanceClaims);frozen(v.commands);
 return frozen(v);
}
export function newP3QuoteLedger(identity:P3Identity):P3QuoteLedger{
 for(const field of ['organizationId','customerId','propertyId','legacyLeadId','opportunityId','quoteId'] as const)
  safeId(identity[field],field);
 if(identity.targetBookingId!==null)safeId(identity.targetBookingId,'targetBookingId');
 return freezeLedger({identity:{...identity},revision:0,versions:[],acceptanceClaims:[],commands:[]});
}
function checkCommand(
 ledger:P3QuoteLedger,commandId:string,expectedRevision:number,signature:string,
):'repeat'|'new'{
 safeId(commandId,'commandId');
 const existing=ledger.commands.find(c=>c.id===commandId);
 if(existing){
  assert(existing.signature===signature,'Idempotency key was reused with different content.');
  return 'repeat';
 }
 assert(Number.isInteger(expectedRevision)&&expectedRevision===ledger.revision,
  'Quote ledger revision conflict. Refresh before writing.');
 return 'new';
}
function appendCommand(ledger:P3QuoteLedger,commandId:string,signature:string):P3CommandRecord[]{
 return [...ledger.commands,{id:commandId,signature,revision:ledger.revision+1}];
}

/**
 * Prepare a new immutable customer-facing quote version. This does NOT mark
 * the customer as approved or create a shared quote row in production.
 */
export function appendP3QuoteVersion(
 ledger:P3QuoteLedger,lead:ExtLead,command:P3CreateVersion,
):P3QuoteLedger{
 const signature=sha(JSON.stringify({
  kind:'new-version',identity:ledger.identity,leadId:lead.id,
  sourceUpdatedAt:lead.updated_at,sourceQuote:lead.quote_amount,
  versionId:command.versionId,actorId:command.actorId,
  occurredAt:command.occurredAt,estimate:command.estimate,
 }));
 if(checkCommand(ledger,command.commandId,command.expectedRevision,signature)==='repeat')
  return ledger;
 safeId(command.versionId,'versionId');safeId(command.actorId,'actorId');
 assert(time(command.occurredAt),'Quote version requires a valid UTC timestamp.');
 assert(lead.id===ledger.identity.legacyLeadId,
  'A quote cannot change its original lead/customer source.');
 assert(isExteriorEstimate(command.estimate,lead.id),
  'Quote has invalid lines or mismatched legacy source.');
 assert(sourceStillMatches(command.estimate,lead),
  'Original lead price or source revision changed. Rebase the internal draft.');
 assert(!ledger.versions.some(v=>v.id===command.versionId),
  'Immutable quote version ID already exists.');
 const totals=computeExteriorEstimate(command.estimate);
 assert(totals.price>0,'Cannot create a zero-price or unpriced proposal version.');
 const scope=command.estimate.lines.map(line=>({
  id:line.id,service:copyText(line.service,120),unit:line.unit,
  quantity:line.quantity,unitPriceCents:cents(line.pricePerUnit),
  notes:copyText(line.notes,800),
 }));
 const sequence=ledger.versions.length+1;
 const body={
  id:command.versionId,sequence,quoteId:ledger.identity.quoteId,
  organizationId:ledger.identity.organizationId,
  createdAt:command.occurredAt,createdBy:command.actorId,
  legacyLeadId:lead.id,sourceUpdatedAt:lead.updated_at,
  sourceQuoteCents:lead.quote_amount===null?null:cents(lead.quote_amount),
  subtotalCents:cents(totals.subtotal),discountCents:cents(totals.discount),
  priceCents:cents(totals.price),scope,
 };
 const contentHash=sha(JSON.stringify({identity:ledger.identity,...body}));
 return freezeLedger({...ledger,revision:ledger.revision+1,
  versions:[...ledger.versions,{...body,contentHash}],
  commands:appendCommand(ledger,command.commandId,signature)});
}
/**
 * A claim is historical information only. It is never verified acceptance,
 * even if its reference looks like a provider ID or document URL.
 */
export function appendP3AcceptanceClaim(
 ledger:P3QuoteLedger,command:P3ClaimAcceptance,
):P3QuoteLedger{
 const signature=sha(JSON.stringify({
  kind:'acceptance-claim',identity:ledger.identity,
  claimId:command.claimId,versionId:command.versionId,
  bookingId:command.bookingId,actorId:command.actorId,
  occurredAt:command.occurredAt,evidenceKind:command.kind,
  reference:command.reference,
 }));
 if(checkCommand(ledger,command.commandId,command.expectedRevision,signature)==='repeat')
  return ledger;
 safeId(command.claimId,'claimId');safeId(command.actorId,'actorId');
 safeId(command.versionId,'versionId');
 if(command.bookingId!==null)safeId(command.bookingId,'bookingId');
 assert(time(command.occurredAt),'Acceptance claim requires a valid UTC time.');
 assert(ledger.versions.some(v=>v.id===command.versionId),
  'Cannot claim approval of a missing quote version.');
 assert(!ledger.acceptanceClaims.some(c=>c.id===command.claimId),
  'Acceptance claim ID already exists.');
 assert(['operator-report','provider-reference','signed-document-reference'].includes(command.kind),
  'Unsupported approval evidence classification.');
 assert(typeof command.reference==='string'&&command.reference.trim().length>=3&&
  command.reference.length<=256&&
  !/[\x00-\x1f]/.test(command.reference),
  'Acceptance reference must be a bounded single-line source.');
 if(ledger.identity.targetBookingId!==null)
  assert(command.bookingId===ledger.identity.targetBookingId,
   'Acceptance claim does not identify the exact intended visit.');
 const claim:P3AcceptanceClaim={
  id:command.claimId,versionId:command.versionId,bookingId:command.bookingId,
  kind:command.kind,reference:command.reference,
  createdAt:command.occurredAt,recordedBy:command.actorId,
  verification:'unverified',
 };
 return freezeLedger({...ledger,revision:ledger.revision+1,
  acceptanceClaims:[...ledger.acceptanceClaims,claim],
  commands:appendCommand(ledger,command.commandId,signature)});
}
const fullyLoaded=(x:{loaded:number;total:number|null}|undefined|null)=>
 !!x&&x.total!==null&&Number.isInteger(x.total)&&x.total>=0&&
 x.loaded===x.total;
const matchesAttestation=(
 ledger:P3QuoteLedger,version:P3QuoteVersion,
 booking:ExtBooking,attestation:P3Attestation,
)=>{
 const i=ledger.identity;
 return attestation.organizationId===i.organizationId&&
  attestation.customerId===i.customerId&&attestation.propertyId===i.propertyId&&
  attestation.quoteId===i.quoteId&&attestation.versionId===version.id&&
  attestation.bookingId===booking.id&&
  attestation.priceCents===version.priceCents&&
  attestation.contentHash===version.contentHash&&
  validId(attestation.externalReceiptId)&&time(attestation.verifiedAt);
};

/**
 * Assess eligibility for a future atomic work-order transaction.
 * Does NOT persist, issue, reserve, approve or dispatch anything.
 * A future trusted server adapter MUST verify external receipts before calling.
 */
export function preflightP3WorkOrder(
 ledger:P3QuoteLedger,ctx:P3OrderContext,
):P3OrderPreflight{
 const blockers:P3OrderBlocker[]=[];
 const block=(v:P3OrderBlocker)=>{if(!blockers.includes(v))blockers.push(v);};
 const identity=ledger.identity;
 if(!fullyLoaded(ctx.data.coverage?.leads)||!fullyLoaded(ctx.data.coverage?.bookings))
  block('source-incomplete');
 const leadRows=ctx.data.leads.filter(l=>l.id===identity.legacyLeadId);
 const bookingRows=ctx.data.bookings.filter(b=>b.id===ctx.booking.id);
 if(leadRows.length!==1||bookingRows.length!==1)block('duplicate-source');
 if(!ctx.sourceLink||ctx.sourceLink.organizationId!==identity.organizationId||
  ctx.sourceLink.customerId!==identity.customerId||
  ctx.sourceLink.propertyId!==identity.propertyId||
  ctx.sourceLink.legacyLeadId!==identity.legacyLeadId)
  block('identity-not-linked');
 if(ctx.booking.lead_id!==identity.legacyLeadId||bookingRows.length!==1||
   bookingRows[0].lead_id!==ctx.booking.lead_id||
   bookingRows[0].date!==ctx.booking.date||
   bookingRows[0].time_block!==ctx.booking.time_block||
   bookingRows[0].status!==ctx.booking.status||
   !validDay(ctx.booking.date))
  block('booking-not-exact');
 if(ctx.booking.status!=='confirmed')block('booking-not-confirmed');
 if(!isValidBlock(ctx.booking.time_block))block('booking-time-invalid');
 if(identity.targetBookingId!==null){
  if(identity.targetBookingId!==ctx.booking.id)block('visit-ambiguous');
 } else {
  const active=ctx.data.bookings.filter(b=>
   b.lead_id===identity.legacyLeadId&&
   (b.status==='confirmed'||b.status==='pending_approval'));
  if(active.length!==1||active[0].id!==ctx.booking.id)block('visit-ambiguous');
 }
 const version=ledger.versions.at(-1);
 if(!version)block('quote-version-missing');
 else if(leadRows.length!==1||version.sourceUpdatedAt!==leadRows[0].updated_at||
  version.sourceQuoteCents!==(leadRows[0].quote_amount===null?
    null:cents(leadRows[0].quote_amount)))
  block('quote-source-stale');
 if(!ctx.acceptance)block('acceptance-unverified');
 else if(!version||!matchesAttestation(ledger,version,ctx.booking,ctx.acceptance))
  block('acceptance-version-mismatch');
 if(!fullyLoaded(ctx.orderCoverage)||ctx.orderCoverage!.loaded!==ctx.existingOrders.length)
  block('workorder-source-incomplete');
 if(ctx.existingOrders.some(o=>o.organizationId===identity.organizationId&&
  o.bookingId===ctx.booking.id))block('workorder-already-exists');
 if(blockers.length||!version||!ctx.acceptance)
  return {eligible:false,blockers,candidate:null};
 const candidate:P3OrderCandidate={
  status:'transaction-not-executed',
  organizationId:identity.organizationId,customerId:identity.customerId,
  propertyId:identity.propertyId,legacyLeadId:identity.legacyLeadId,
  opportunityId:identity.opportunityId,quoteId:identity.quoteId,
  quoteVersionId:version.id,quoteVersionHash:version.contentHash,
  priceCents:version.priceCents,bookingId:ctx.booking.id,
  bookingDate:ctx.booking.date,bookingTimeBlock:ctx.booking.time_block!,
  customerScope:version.scope.map(line=>({...line})),
  externalAcceptanceReceiptId:ctx.acceptance.externalReceiptId,
 };
 candidate.customerScope.forEach(frozen);frozen(candidate.customerScope);
 return {eligible:true,blockers:[],candidate:frozen(candidate)};
}
