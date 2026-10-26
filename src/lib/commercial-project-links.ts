import {commercialUuid} from './commercial-accounts';

export type CommercialProjectLink={
  accountId:string|null;propertyId:string|null;revision:number;updatedAt:string;
};
export type CommercialLinkedProject={
  projectId:string;title:string;phase:string;propertyId:string;linkRevision:number;
};
export type CommercialLinkedProjectsPage={projects:CommercialLinkedProject[];hasMore:boolean};

const record=(raw:unknown,label:string):Record<string,unknown>=>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid '+label+'.');
 return raw as Record<string,unknown>;
};
const uuid=(raw:unknown,label:string):string=>{
 if(typeof raw!=='string'||!commercialUuid.test(raw))throw Error('Invalid '+label+'.');
 return raw.toLowerCase();
};
export function commercialProjectLinkSelection(accountId:string|null,propertyId:string|null){
 if((accountId===null)!==(propertyId===null))throw Error('Select a company AND its exact property.');
 return {accountId:accountId===null?null:uuid(accountId,'company ID'),
  propertyId:propertyId===null?null:uuid(propertyId,'company property ID')};
}
export function parseCommercialProjectLink(raw:unknown):CommercialProjectLink|null{
 if(raw===null)return null;
 const v=record(raw,'commercial project link');
 if(!Number.isSafeInteger(v.revision)||!(v.revision as number>0)||typeof v.updatedAt!=='string'
   ||!Number.isFinite(Date.parse(v.updatedAt)))throw Error('Invalid commercial link version.');
 const {accountId,propertyId}=commercialProjectLinkSelection(
  v.accountId===null?null:uuid(v.accountId,'link company'),
  v.propertyId===null?null:uuid(v.propertyId,'link property'));
 return {accountId,propertyId,revision:v.revision as number,updatedAt:v.updatedAt};
}
export function parseCommercialLinkedProjectsPage(raw:unknown):CommercialLinkedProjectsPage{
 const page=record(raw,'company project list');
 if(!Array.isArray(page.projects)||page.projects.length>100||typeof page.hasMore!=='boolean')
  throw Error('Invalid company project page.');
 const projects=page.projects.map(x=>{
  const p=record(x,'linked project');
  if(typeof p.title!=='string'||p.title.length>160||typeof p.phase!=='string'||p.phase.length>40
   ||!Number.isSafeInteger(p.linkRevision)||!(p.linkRevision as number>0))
    throw Error('Invalid linked project values.');
  return {projectId:uuid(p.projectId,'project'),title:p.title,phase:p.phase,
   propertyId:uuid(p.propertyId,'linked property'),linkRevision:p.linkRevision as number};
 });
 if(new Set(projects.map(p=>p.projectId)).size!==projects.length)throw Error('Duplicate link projects.');
 return {projects,hasMore:page.hasMore};
}
export function parseProjectLinkSaveReceipt(raw:unknown):
 {status:'saved';revision:number;replayed:boolean}|{status:'conflict';revision:number}{
 const v=record(raw,'project link receipt');
 if(v.ok===false&&v.conflict===true&&Number.isSafeInteger(v.currentRevision)
   &&(v.currentRevision as number>=0))
   return {status:'conflict',revision:v.currentRevision as number};
 if(v.ok!==true||typeof v.replayed!=='boolean'||!Number.isSafeInteger(v.revision)
  ||!(v.revision as number>0))throw Error('Invalid project link save receipt.');
 return {status:'saved',revision:v.revision as number,replayed:v.replayed};
}
