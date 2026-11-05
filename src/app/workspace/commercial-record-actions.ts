'use server';

import {requireMember} from '@/lib/supabase';
import {commercialUuid,type CompanyRecord,type CompanyRecordKind} from '@/lib/commercial-accounts';

// 42703: the commercial_account_id column is not there yet (the staged SQL has not been run).
const notInstalled=(code?:string)=>code==='42703'||code==='PGRST204'||code==='42883'||code==='PGRST202';
type Row=Record<string,unknown>;
const str=(v:unknown)=>typeof v==='string'?v:'';
const num=(v:unknown)=>typeof v==='number'?v:typeof v==='string'&&v!==''?Number(v):null;
const toRecords=(p:Row[],i:Row[],d:Row[]):CompanyRecord[]=>[
 ...p.map(r=>({kind:'proposal' as const,id:str(r.id),title:'Proposal '+str(r.number),customer:str(r.customer_name),status:str(r.status),
  date:str(r.sent_on)||str(r.created_at).slice(0,10),totalCents:num(r.total_cents),paidCents:null})),
 ...i.map(r=>({kind:'invoice' as const,id:str(r.id),title:'Invoice '+str(r.number),customer:str(r.customer_name),status:str(r.status),
  date:str(r.issue_date),totalCents:num(r.total_cents),paidCents:num(r.paid_cents)})),
 ...d.map(r=>({kind:'document' as const,id:str(r.id),title:str(r.name),customer:'',status:str(r.tag),
  date:str(r.created_at).slice(0,10),totalCents:null,paidCents:null})),
].sort((a,b)=>b.date.localeCompare(a.date));

/** Records linked to one company (accountId), or the unlinked ones that could be (accountId null). */
export async function loadCompanyRecords(org:string,accountId:string|null):Promise<{installed:boolean;records:CompanyRecord[]}>{
 if(!commercialUuid.test(org)||(accountId!==null&&!commercialUuid.test(accountId)))throw Error('Invalid company reference.');
 const {client}=await requireMember(org,true);
 const limit=accountId?200:60;
 const proposals=client.from('oj_proposals').select('id,number,customer_name,status,total_cents,sent_on,created_at').eq('organization_id',org);
 const invoices=client.from('oj_invoices').select('id,number,customer_name,status,total_cents,paid_cents,issue_date').eq('organization_id',org);
 const documents=client.from('oj_documents').select('id,name,tag,created_at').eq('organization_id',org);
 const [p,i,d]=await Promise.all([
  (accountId?proposals.eq('commercial_account_id',accountId):proposals.is('commercial_account_id',null)).order('created_at',{ascending:false}).limit(limit),
  (accountId?invoices.eq('commercial_account_id',accountId):invoices.is('commercial_account_id',null)).order('issue_date',{ascending:false}).limit(limit),
  (accountId?documents.eq('commercial_account_id',accountId):documents.is('commercial_account_id',null)).order('created_at',{ascending:false}).limit(limit),
 ]);
 const failed=[p.error,i.error,d.error].find(Boolean);
 if(failed){
  if(notInstalled(failed.code))return {installed:false,records:[]};
  throw Error('Could not read this company\'s proposals, invoices and documents. Try again.');
 }
 return {installed:true,records:toRecords(p.data??[],i.data??[],d.data??[])};
}

export async function linkCompanyRecord(org:string,kind:CompanyRecordKind,recordId:string,accountId:string|null){
 if(!commercialUuid.test(org)||!commercialUuid.test(recordId)||(accountId!==null&&!commercialUuid.test(accountId))
  ||!['proposal','invoice','document'].includes(kind))throw Error('Invalid link request.');
 const {client}=await requireMember(org,true);
 const {error}=await client.rpc('oj_commercial_link_record',{
  p_organization_id:org,p_kind:kind,p_record_id:recordId,p_account_id:accountId,
 });
 if(error){
  if(notInstalled(error.code))throw Error('Company links are not switched on yet. Run the staged company links SQL first.');
  if(error.code==='42501')throw Error('Your account cannot link records in this workspace.');
  throw Error('The link did not save. Try again.');
 }
}
