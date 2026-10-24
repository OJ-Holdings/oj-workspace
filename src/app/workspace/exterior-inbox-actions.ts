'use server';

import {requireMember} from '@/lib/supabase';
import {businessDay} from '@/lib/reporting';
import type {Card} from '@/lib/board';
import type {ExtLead,ExtBooking} from '@/lib/exterior';
import {parseJobFollowupReceipt,uuid} from '@/lib/exterior-job-followup';
import {buildExteriorOperationsInbox,type ExteriorInboxReport} from '@/lib/exterior-operations-inbox';

/**
 * R38 existing-schema shared Work Inbox. Every read is scoped to the caller's
 * server-side Supabase Auth session, organization membership and RLS.
 * No service-role, new table, cross-org scan, signed-off source, inferred cash
 * or "fallback" to fabricated sample records when the source fails.
 */
export type ExteriorInboxLoad=
 |{ok:true;report:ExteriorInboxReport;loadedAt:string}
 |{ok:false;reason:string};

const selected='id,organization_id,title,description,business,stage,priority,assignee,due_date,revision,checklist,created_at,updated_at';
const candidateLimit=180;
export async function loadExteriorOperationsInbox(org:string):Promise<ExteriorInboxLoad>{
 if(typeof org!=='string'||!uuid.test(org))
  return {ok:false,reason:'A valid organization is required.'};
 try{
  const {client,member}=await requireMember(org,true);
  if(member.role!=='owner'&&member.role!=='member')
   return {ok:false,reason:'The operations inbox requires active team membership.'};
  const now=new Date();
  const today=businessDay(now.toISOString());
  if(!today)return {ok:false,reason:'Business date could not be verified.'};
  const [cardsResult,membersResult]=await Promise.all([
   client.from('oj_cards').select(selected,{count:'exact'})
    .eq('organization_id',org).eq('business','exterior')
    .like('description','OJ_EXTERIOR_JOB_FOLLOWUP_V1%')
    .order('updated_at',{ascending:false}).limit(candidateLimit),
   client.from('oj_memberships').select('display_name,role')
    .eq('organization_id',org).limit(100),
  ]);
  if(cardsResult.error||!cardsResult.data||
     membersResult.error||!membersResult.data)
   return {ok:false,reason:'The live company task source was unavailable. Nothing was substituted.'};
  const cards=cardsResult.data as Card[];
  const scope=cards.map(c=>parseJobFollowupReceipt(c.description))
   .filter((r):r is NonNullable<typeof r>=>!!r&&r.organizationId===org);
  const bookingsIds=[...new Set(scope.map(s=>s.bookingId))];
  const leadIds=[...new Set(scope.map(s=>s.leadId))];
  let bookings:ExtBooking[]=[];
  let leads:ExtLead[]=[];
  if(bookingsIds.length){
   const result=await client.from('bookings').select('id,lead_id,date,time_block,status')
    .in('id',bookingsIds);
   if(result.error||!result.data)
    return {ok:false,reason:'Original bookings could not be verified. No task source status was inferred.'};
   bookings=result.data as ExtBooking[];
  }
  if(leadIds.length){
   const result=await client.from('leads').select('id,name,service_requested')
    .in('id',leadIds);
   if(result.error||!result.data)
    return {ok:false,reason:'Original customer source was unavailable. No customer identity was inferred.'};
   leads=result.data as ExtLead[];
  }
  const matches=membersResult.data.filter(m=>
   (m.role==='owner'||m.role==='member')&&m.display_name===member.display_name
  ).length;
  const report=buildExteriorOperationsInbox(
   org,cards,bookings,leads,member.display_name,matches,today,cardsResult.count,
  );
  return {ok:true,report,loadedAt:now.toISOString()};
 }catch{
  return {ok:false,reason:'The authorized shared operations inbox is unavailable. Check the connection or membership and retry.'};
 }
}
