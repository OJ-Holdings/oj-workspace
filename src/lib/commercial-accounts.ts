/** Company accounts are not legacy residential customers and must never be
 * inferred from a matching name, phone number or property address. */
export const commercialAccountMaxContacts=20;
export const commercialAccountMaxProperties=30;
export const commercialUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type CommercialContact={id:string;fullName:string;role:string;email:string;phone:string};
export type CommercialProperty={id:string;name:string;address:string;serviceNotes:string;frequency:'unknown'|'one-time'|'monthly'|'quarterly'|'annual'};
export type CommercialAccountDraft={
 name:string;industry:string;website:string;notes:string;
 contacts:CommercialContact[];properties:CommercialProperty[];
};
export type CommercialAccount=CommercialAccountDraft&{
 id:string;revision:number;createdAt:string;updatedAt:string;
};
const obj=(x:unknown):Record<string,unknown>=>{
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Invalid company record.');
 return x as Record<string,unknown>;
};
const string=(x:unknown,name:string,max:number,min=0):string=>{
 if(typeof x!=='string'||x.length>max||x.trim().length<min)throw Error('Invalid '+name+'.');
 return x.trim();
};
const id=(x:unknown):string=>{
 if(typeof x!=='string'||!commercialUuid.test(x))throw Error('Invalid company or record ID.');
 return x.toLowerCase();
};
const allowed=new Set<CommercialProperty['frequency']>(['unknown','one-time','monthly','quarterly','annual']);
export function validateCommercialAccountDraft(raw:unknown):CommercialAccountDraft{
 const v=obj(raw);
 if(!Array.isArray(v.contacts)||v.contacts.length>commercialAccountMaxContacts
  ||!Array.isArray(v.properties)||v.properties.length>commercialAccountMaxProperties)throw Error('Too many contacts or properties.');
 const contacts=v.contacts.map(x=>{
  const c=obj(x);
  return {id:id(c.id),fullName:string(c.fullName,'contact name',120,1),
   role:string(c.role,'contact role',80),email:string(c.email,'email',180),
   phone:string(c.phone,'phone',60)} satisfies CommercialContact;
 });
 const properties=v.properties.map(x=>{
  const p=obj(x);
  if(!allowed.has(p.frequency as CommercialProperty['frequency']))throw Error('Invalid service frequency.');
  return {id:id(p.id),name:string(p.name,'property name',120,1),
   address:string(p.address,'property address',300),
   serviceNotes:string(p.serviceNotes,'service notes',2000),
   frequency:p.frequency as CommercialProperty['frequency']} satisfies CommercialProperty;
 });
 if(new Set(contacts.map(c=>c.id)).size!==contacts.length
  ||new Set(properties.map(p=>p.id)).size!==properties.length)throw Error('Duplicate company contact or property identifiers.');
 const data={
  name:string(v.name,'company name',160,1),industry:string(v.industry,'industry',80),
  website:string(v.website,'website',240),notes:string(v.notes,'company notes',2000),
  contacts,properties,
 };
 if(new TextEncoder().encode(JSON.stringify(data)).byteLength>60000)throw Error('Company profile exceeds size limit.');
 return data;
}
export function parseCommercialAccountsPage(raw:unknown):{accounts:CommercialAccount[];hasMore:boolean}{
 const page=obj(raw);
 if(typeof page.hasMore!=='boolean'||!Array.isArray(page.accounts)||page.accounts.length>50)throw Error('Invalid company listing.');
 const accounts=page.accounts.map(record=>{
  const a=obj(record);
  const revision=a.revision;
  if(!Number.isSafeInteger(revision)||!(revision as number>0)||
   typeof a.createdAt!=='string'||!Number.isFinite(Date.parse(a.createdAt))||
   typeof a.updatedAt!=='string'||!Number.isFinite(Date.parse(a.updatedAt)))throw Error('Invalid company revision.');
  return {id:id(a.id),revision:revision as number,createdAt:a.createdAt,updatedAt:a.updatedAt,
   ...validateCommercialAccountDraft(a)} satisfies CommercialAccount;
 });
 if(new Set(accounts.map(a=>a.id)).size!==accounts.length)throw Error('Duplicate company IDs.');
 return {accounts,hasMore:page.hasMore};
}
export function parseAccountReceipt(raw:unknown):{status:'saved';revision:number;replayed:boolean}|{status:'conflict';revision:number}{
 const x=obj(raw);
 if(x.ok===false&&x.conflict===true&&Number.isSafeInteger(x.currentRevision))
  return {status:'conflict',revision:x.currentRevision as number};
 if(x.ok!==true||!Number.isSafeInteger(x.revision)||!(x.revision as number>0)||typeof x.replayed!=='boolean')
  throw Error('Invalid company save receipt.');
 return {status:'saved',revision:x.revision as number,replayed:x.replayed};
}


/**
 * Resolve an explicit operator-selected property using its exact saved UUID.
 * Never infer a customer or service property from a matching name/address.
 * This is an unsaved estimate suggestion, not an account/project association.
 */
export function prepareCommercialPropertyEstimate(account:CommercialAccount,propertyId:string){
 if(!commercialUuid.test(account.id)||!commercialUuid.test(propertyId))
  throw Error('Invalid saved commercial account or property.');
 const property=account.properties.find(p=>p.id===propertyId);
 if(!property)throw Error('Selected property is not on this saved commercial account.');
 return {
  accountId:account.id,accountName:account.name,
  propertyId:property.id,propertyName:property.name,
  suggestedEstimateTitle:(account.name+' · '+property.name).slice(0,160),
 };
}
