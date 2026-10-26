'use server';

import { isDeepStrictEqual } from 'node:util';
import { requireMember } from '@/lib/supabase';
import {
 commercialUuid,parseAccountReceipt,parseCommercialAccountsPage,
 validateCommercialAccountDraft,type CommercialAccountDraft,
} from '@/lib/commercial-accounts';

const storageCodes=new Set(['42P01','42883','PGRST202','PGRST204','PGRST205']);
function storageError(code?:string):string{
 if(storageCodes.has(code??''))return 'Commercial Accounts storage is not installed. No private business data was overwritten.';
 if(code==='42501')return 'Your signed-in account cannot access this company profile.';
 return 'Could not verify shared company records. Keep the current edits and retry.';
}
export async function loadCommercialAccounts(org:string){
 if(!commercialUuid.test(org))throw Error('Invalid company organization ID.');
 const {client}=await requireMember(org,true);
 const {data,error}=await client.rpc('oj_commercial_accounts_list',{
  p_organization_id:org,p_limit:50,
 });
 if(error)throw Error(storageError(error.code));
 return parseCommercialAccountsPage(data);
}
export async function saveCommercialAccount(
 org:string,accountId:string,expectedRevision:number,commandId:string,raw:CommercialAccountDraft,
){
 if(!commercialUuid.test(org)||!commercialUuid.test(accountId)||!commercialUuid.test(commandId)
  ||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Invalid company save identifiers.');
 const draft=validateCommercialAccountDraft(raw);
 const {client}=await requireMember(org,true);
 const {data,error}=await client.rpc('oj_commercial_account_save',{
  p_organization_id:org,p_account_id:accountId,p_expected_revision:expectedRevision,
  p_command_id:commandId,p_payload:draft,
 });
 if(error)throw Error(storageError(error.code));
 const receipt=parseAccountReceipt(data);
 if(receipt.status==='conflict')return receipt;
 // Verify each write against this account's stored revision, not only the RPC receipt.
 const page=await loadCommercialAccounts(org);
 const actual=page.accounts.find(a=>a.id===accountId.toLowerCase());
 if(!actual)throw Error('Company save returned a receipt, but the record could not be read back.');
 if(actual.revision!==receipt.revision)return {status:'conflict' as const,revision:actual.revision};
 const sorted=(v:CommercialAccountDraft)=>({
  ...v,
  contacts:[...v.contacts].sort((a,b)=>a.id.localeCompare(b.id)),
  properties:[...v.properties].sort((a,b)=>a.id.localeCompare(b.id)),
 });
 // Omitted existing entries intentionally remain in relational storage:
 // a partial update must not silently delete shared contacts or properties.
 const sent=sorted(draft);
 const received=sorted(actual);
 if(sent.name!==received.name||sent.industry!==received.industry||
  sent.website!==received.website||sent.notes!==received.notes||
  sent.contacts.some(c=>!received.contacts.some(x=>isDeepStrictEqual(x,c)))||
  sent.properties.some(p=>!received.properties.some(x=>isDeepStrictEqual(x,p)))){
  throw Error('Shared account read-back differs from the submitted values; keep the original save command.');
 }
 return {status:'saved' as const,revision:actual.revision,replayed:receipt.replayed};
}
