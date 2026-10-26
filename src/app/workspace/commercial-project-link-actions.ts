'use server';

import {requireMember} from '@/lib/supabase';
import {loadCommercialProject} from './commercial-actions';
import {commercialUuid} from '@/lib/commercial-accounts';
import {
 commercialProjectLinkSelection,parseCommercialProjectLink,
 parseCommercialLinkedProjectsPage,parseProjectLinkSaveReceipt,
} from '@/lib/commercial-project-links';
const setupMissing=new Set(['42P01','42883','PGRST202','PGRST204','PGRST205']);
const failure=(code?:string)=>{
 if(setupMissing.has(code??''))return 'Project-to-account linking is not installed. Your commercial projects are unchanged.';
 if(code==='42501')return 'Your account does not have permission for this company project.';
 return 'Project-to-company link could not be verified. Keep the original selection and retry.';
};
export async function loadCommercialProjectLink(org:string,projectId:string){
 if(!commercialUuid.test(org)||!commercialUuid.test(projectId))throw Error('Invalid project reference.');
 const {client}=await requireMember(org,true);
 const {data,error}=await client.rpc('oj_commercial_project_link_get',{
  p_organization_id:org,p_project_id:projectId,
 });
 if(error)throw Error(failure(error.code));
 return parseCommercialProjectLink(data);
}
export async function listCommercialAccountProjects(org:string,accountId:string){
 if(!commercialUuid.test(org)||!commercialUuid.test(accountId))throw Error('Invalid company reference.');
 const {client}=await requireMember(org,true);
 const {data,error}=await client.rpc('oj_commercial_account_projects',{
  p_organization_id:org,p_account_id:accountId,
 });
 if(error)throw Error(failure(error.code));
 return parseCommercialLinkedProjectsPage(data);
}
export async function saveCommercialProjectLink(
 org:string,projectId:string,expectedRevision:number,commandId:string,
 accountId:string|null,propertyId:string|null,
){
 if(!commercialUuid.test(org)||!commercialUuid.test(projectId)||!commercialUuid.test(commandId)
  ||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
  throw Error('Invalid company-project save reference.');
 const target=commercialProjectLinkSelection(accountId,propertyId);
 const project=await loadCommercialProject(org,projectId);
 if(!project)throw Error('Save the commercial project to shared storage before linking a company.');
 const {client}=await requireMember(org,true);
 const {data,error}=await client.rpc('oj_commercial_project_link_save',{
  p_organization_id:org,p_project_id:projectId,
  p_expected_revision:expectedRevision,p_command_id:commandId,
  p_account_id:target.accountId,p_property_id:target.propertyId,
 });
 if(error)throw Error(failure(error.code));
 const receipt=parseProjectLinkSaveReceipt(data);
 if(receipt.status==='conflict')return receipt;
 const stored=await loadCommercialProjectLink(org,projectId);
 if(!stored)throw Error('Link save was recorded but no link can be read back. Retry original command.');
 if(stored.revision!==receipt.revision)return {status:'conflict' as const,revision:stored.revision};
 if(stored.accountId!==target.accountId||stored.propertyId!==target.propertyId)
  throw Error('Saved association differs from this selection. Keep the original command and reconcile.');
 return receipt;
}
