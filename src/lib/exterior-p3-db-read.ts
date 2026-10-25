import 'server-only';
import {requireMember} from './supabase';
import {readP3BookingProjection,type P3ReadPort,type P3ProjectionResult} from './exterior-p3-data';

/**
 * The caller's Supabase session, current membership and database RLS are
 * required at every read. There is NO service-role or admin key in this path.
 * A missing P3 staging table is a failure (not an empty or fake quote).
 */
export async function getP3OriginalBookingRead(
 organizationId:string,bookingId:string,
):Promise<P3ProjectionResult|{ok:false;reason:'unavailable'|'access-denied'}>{
 let client:Awaited<ReturnType<typeof requireMember>>['client'];
 try{({client}=await requireMember(organizationId,true));}
 catch{return {ok:false,reason:'access-denied'};}
 const one=async <T>(table:string,fields:string,equals:Record<string,string|number>):Promise<T|null>=>{
  let query=client.from(table).select(fields);
  for(const [k,v] of Object.entries(equals))query=query.eq(k,v);
  const {data,error}=await query.limit(2);
  if(error)throw Error('P3 data access source is unavailable.');
  if(!data||data.length>1)throw Error('P3 data source is ambiguous.');
  return (data[0]??null) as T|null;
 };
 const port:P3ReadPort={
  booking:id=>one('bookings','id,lead_id,date,time_block,status',{id}),
  lead:id=>one('leads','id,name,address,service_requested,updated_at,quote_amount',{id}),
  link:(org,id)=>one('oj_exterior_legacy_links','organization_id,legacy_lead_id,customer_id,property_id',
   {organization_id:org,legacy_lead_id:id}),
  customer:(org,id)=>one('oj_exterior_customers','organization_id,id,display_name',
   {organization_id:org,id}),
  property:(org,id)=>one('oj_exterior_properties','organization_id,id,customer_id,address_text',
   {organization_id:org,id}),
  opportunity:(org,lead,booking)=>one('oj_exterior_opportunities',
   'organization_id,id,legacy_lead_id,customer_id,property_id,target_booking_id',
   {organization_id:org,legacy_lead_id:lead,target_booking_id:booking}),
  quote:(org,opp)=>one('oj_exterior_quotes',
   'organization_id,id,opportunity_id,revision,latest_version_sequence',
   {organization_id:org,opportunity_id:opp}),
  version:(org,id,sequence)=>one('oj_exterior_quote_versions',
   'organization_id,id,quote_id,sequence,source_updated_at,source_quote_cents,price_cents,content_hash,scope',
   {organization_id:org,quote_id:id,sequence}),
  orders:async(org,booking)=>{
   const {data,error}=await client.from('oj_exterior_work_orders').select(
    'organization_id,id,opportunity_id,quote_id,version_id,booking_id,status,price_cents',
   ).eq('organization_id',org).eq('booking_id',booking).limit(3);
   if(error||!data)throw Error('P3 work order source is unavailable.');
   return data;
  },
 };
 try{return await readP3BookingProjection(port,organizationId,bookingId);}
 catch{return {ok:false,reason:'unavailable'};}
}
