import {validLegacySourceId, type P3PublicLine} from './exterior-p3-workflow';

/**
 * Release 50: exact-source, organization-scoped READ contract for the P3 spine.
 * No financial settlement, customer acceptance or dispatch is implied.
 * A caller must authenticate an active owner/member AND enforce PostgreSQL RLS.
 * Port errors must fail closed; a missing P3 schema is NOT an empty portfolio.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type OriginalBooking={
 id:string;lead_id:string|null;date:string;time_block:string|null;status:string|null;
};
type OriginalLead={id:string;name:string|null;address:string|null;
 service_requested:string|null;updated_at:string|null;quote_amount:number|null};
type Link={organization_id:string;legacy_lead_id:string;customer_id:string;property_id:string};
type Customer={organization_id:string;id:string;display_name:string};
type Property={organization_id:string;id:string;customer_id:string;address_text:string};
type Opportunity={organization_id:string;id:string;legacy_lead_id:string;customer_id:string;
 property_id:string;target_booking_id:string|null};
type Quote={organization_id:string;id:string;opportunity_id:string;revision:number;
 latest_version_sequence:number};
type Version={organization_id:string;id:string;quote_id:string;sequence:number;
 source_updated_at:string|null;source_quote_cents:number|null;price_cents:number;
 content_hash:string;scope:unknown};
type WorkOrder={organization_id:string;id:string;opportunity_id:string;
 quote_id:string;version_id:string;booking_id:string;status:string;price_cents:number};
export type P3ReadPort={
 booking:(id:string)=>Promise<OriginalBooking|null>;
 lead:(id:string)=>Promise<OriginalLead|null>;
 link:(org:string,leadId:string)=>Promise<Link|null>;
 customer:(org:string,customerId:string)=>Promise<Customer|null>;
 property:(org:string,propertyId:string)=>Promise<Property|null>;
 opportunity:(org:string,leadId:string,bookingId:string)=>Promise<Opportunity|null>;
 quote:(org:string,opportunityId:string)=>Promise<Quote|null>;
 version:(org:string,quoteId:string,sequence:number)=>Promise<Version|null>;
 orders:(org:string,bookingId:string)=>Promise<WorkOrder[]>;
};
export type P3BookingProjection={
 organizationId:string;bookingId:string;leadId:string;
 source:{date:string;time:string|null;status:string|null;updatedAt:string|null;
  customerName:string|null;service:string|null;site:string|null};
 canonical:{customerId:string;customerName:string;propertyId:string;site:string;
  opportunityId:string}|null;
 quote:{id:string;revision:number;latestSequence:number;versionId:string;
  priceCents:number;contentHash:string;scope:ReadonlyArray<P3PublicLine>}|null;
 orders:ReadonlyArray<{id:string;versionId:string;status:string;priceCents:number}>;
 flags:ReadonlyArray<string>;
};
export type P3ProjectionResult=
 |{ok:true;state:'source-only'|'linked';projection:P3BookingProjection}
 |{ok:false;reason:'invalid-source'|'not-found'|'not-linked'|'inconsistent-source'|'changed-source'};
const matches=(a:OriginalBooking,b:OriginalBooking)=>
 a.id===b.id&&a.lead_id===b.lead_id&&a.date===b.date&&
 a.time_block===b.time_block&&a.status===b.status;
function assert(yes:unknown):asserts yes {if(!yes)throw Error('P3 source relationship is inconsistent.');}
function publicScope(v:unknown):ReadonlyArray<P3PublicLine>{
 assert(Array.isArray(v)&&v.length>0&&v.length<=24);
 const ids=new Set<string>();
 return (v as unknown[]).map(raw=>{
  assert(raw!==null&&typeof raw==='object'&&!Array.isArray(raw));
  const x=raw as Record<string,unknown>;
  assert(Object.keys(x).every(k=>['id','service','unit','quantity','unitPriceCents','notes'].includes(k)));
  assert(typeof x.id==='string'&&x.id.length>0&&x.id.length<=80&&!ids.has(x.id));
  ids.add(x.id as string);
  assert(typeof x.service==='string'&&x.service.trim()!==''&&x.service.length<=120);
  assert(['flat','each','sqft','linear_ft','pane','hour'].includes(String(x.unit)));
  assert(typeof x.quantity==='number'&&Number.isFinite(x.quantity)&&x.quantity>0&&x.quantity<=100000);
  assert(Number.isSafeInteger(x.unitPriceCents)&&Number(x.unitPriceCents)>=0);
  assert(x.notes===undefined||(typeof x.notes==='string'&&x.notes.length<=800));
  return {
   id:x.id as string,service:x.service as string,unit:x.unit as P3PublicLine['unit'],
   quantity:x.quantity as number,unitPriceCents:x.unitPriceCents as number,
   notes:(x.notes??'') as string,
  };
 });
}
/**
 * A projection uses the original booking's ID, never a name/phone lookup.
 * Re-reads the original source and quote revision to detect most ordinary
 * concurrent edits (not an atomic, cross-table snapshot: a future SQL
 * transaction must provide that for persisted work-order mutations).
 */
export async function readP3BookingProjection(
 port:P3ReadPort,org:string,bookingId:string,
):Promise<P3ProjectionResult>{
 if(!uuid.test(org)||!validLegacySourceId(bookingId))
  return {ok:false,reason:'invalid-source'};
 const booking=await port.booking(bookingId);
 if(!booking)return {ok:false,reason:'not-found'};
 if(booking.id!==bookingId||!booking.lead_id||!validLegacySourceId(booking.lead_id))
  return {ok:false,reason:'inconsistent-source'};
 const lead=await port.lead(booking.lead_id);
 if(!lead||lead.id!==booking.lead_id)return {ok:false,reason:'inconsistent-source'};
 const source:P3BookingProjection['source']={
  date:booking.date,time:booking.time_block,status:booking.status,
  updatedAt:lead.updated_at,customerName:lead.name,
  service:lead.service_requested,site:lead.address,
 };
 const linked=await port.link(org,lead.id);
 // Legacy leads/bookings may predate organization scoping. NEVER return their
 // contact/site fields across tenants without an exact tenant-owned mapping.
 if(!linked)return {ok:false,reason:'not-linked'};
 let canonical:P3BookingProjection['canonical']=null;
 let quote:P3BookingProjection['quote']=null;
 let quoteCheck:Quote|null=null;
 let orders:P3BookingProjection['orders']=[];
 const flags:string[]=[];
 if(linked){
  assert(linked.organization_id===org&&linked.legacy_lead_id===lead.id&&
   uuid.test(linked.customer_id)&&uuid.test(linked.property_id));
  const [customer,property,opportunity]=await Promise.all([
   port.customer(org,linked.customer_id),
   port.property(org,linked.property_id),
   port.opportunity(org,lead.id,bookingId),
  ]);
  assert(customer&&property&&customer.organization_id===org&&property.organization_id===org&&
   customer.id===linked.customer_id&&property.id===linked.property_id&&
   property.customer_id===customer.id);
  if(opportunity){
   assert(opportunity.organization_id===org&&opportunity.legacy_lead_id===lead.id&&
    opportunity.target_booking_id===bookingId&&
    opportunity.customer_id===customer.id&&opportunity.property_id===property.id);
   canonical={
    customerId:customer.id,customerName:customer.display_name,
    propertyId:property.id,site:property.address_text,opportunityId:opportunity.id,
   };
   const head=await port.quote(org,opportunity.id);
   if(head){
    assert(head.organization_id===org&&head.opportunity_id===opportunity.id&&
     uuid.test(head.id)&&Number.isInteger(head.revision)&&head.revision>=0&&
     Number.isInteger(head.latest_version_sequence)&&head.latest_version_sequence>=0);
    quoteCheck=head;
    if(head.latest_version_sequence>0){
     const version=await port.version(org,head.id,head.latest_version_sequence);
     assert(version&&version.organization_id===org&&version.quote_id===head.id&&
      version.sequence===head.latest_version_sequence&&
      version.content_hash.length===64&&Number.isSafeInteger(version.price_cents)&&
      version.price_cents>0);
     quote={id:head.id,revision:head.revision,latestSequence:head.latest_version_sequence,
      versionId:version.id,priceCents:version.price_cents,contentHash:version.content_hash,
      scope:publicScope(version.scope)};
     if(lead.updated_at!==version.source_updated_at ||
       (lead.quote_amount===null?null:Math.round(lead.quote_amount*100))!==version.source_quote_cents)
      flags.push('source-quote-changed');
    }else flags.push('no-version');
   }else flags.push('no-quote');
   const all=await port.orders(org,bookingId);
   assert(all.length<=2);
   for(const order of all){
    assert(order.organization_id===org&&order.booking_id===bookingId&&
     order.opportunity_id===opportunity.id&&quoteCheck&&order.quote_id===quoteCheck.id&&
     Number.isSafeInteger(order.price_cents)&&order.price_cents>0);
   }
   if(all.length>1)return {ok:false,reason:'inconsistent-source'};
   orders=all.map(order=>({
    id:order.id,versionId:order.version_id,status:order.status,priceCents:order.price_cents,
   }));
  }else flags.push('no-exact-opportunity');
 }
 if(!quote)flags.push('no-accepted-quote-evidence');
 if(!orders.length)flags.push('no-work-order');
 const [fresh,freshLead,freshHead]=await Promise.all([
  port.booking(bookingId),port.lead(lead.id),
  quoteCheck&&canonical?port.quote(org,canonical.opportunityId):Promise.resolve(null),
 ]);
 if(!fresh||!matches(booking,fresh)||!freshLead||freshLead.id!==lead.id||
  freshLead.updated_at!==lead.updated_at||freshLead.quote_amount!==lead.quote_amount||
  (quoteCheck&&( !freshHead||freshHead.id!==quoteCheck.id||
   freshHead.revision!==quoteCheck.revision||
   freshHead.latest_version_sequence!==quoteCheck.latest_version_sequence)))
  return {ok:false,reason:'changed-source'};
 return {ok:true,state:canonical?'linked':'source-only',
  projection:{organizationId:org,bookingId,leadId:lead.id,source,canonical,quote,orders,flags}};
}
