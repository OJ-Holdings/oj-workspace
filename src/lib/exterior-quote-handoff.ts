import type {ExtBooking,ExtLead} from './exterior';
import {
  computeExteriorEstimate,isExteriorEstimate,
  type ExteriorEstimate,type EstimateLine,type LocalEstimateBook,type LocalRevision,
} from './exterior-estimate';

/**
 * Offline exchange bridge only. Not synchronized cloud storage, a customer proposal,
 * signature, invoice, or verified acceptance. The person exporting controls the file.
 */
export const quoteHandoffFormat='oj-exterior-internal-quote';
export const quoteHandoffVersion=1;
export const quoteHandoffMaxChars=120000;

export type QuoteHandoff={
 format:typeof quoteHandoffFormat;version:typeof quoteHandoffVersion;
 organization_id:string;lead_id:string;exported_at:string;
 status:'internal-draft';book:LocalEstimateBook;
};
export type QuoteHandoffPreflight={
 sourceMatch:boolean;sourcePriceMatch:boolean;canRecordSharedPrice:boolean;
 hasLinkedBooking:boolean;linkedBookingCount:number;
 externalCustomerAcceptance:'unverified';warnings:string[];
};
const obj=(v:unknown,label:string):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error(label+' must be an object.');
 return v as Record<string,unknown>;
};
const str=(v:unknown,label:string,max:number,required=false):string=>{
 if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(label+' is not valid.');
 return v;
};
const dateTime=(s:string)=>{
 const v=new Date(s);
 if(!/^\d{4}-\d\d-\d\dT/.test(s)||!Number.isFinite(v.getTime())||v.toISOString()!==s)throw Error('Export date must be a valid UTC timestamp.');
 return s;
};
function scrubEstimate(raw:unknown,leadId:string):ExteriorEstimate{
 const v=obj(raw,'Estimate');
 // Validate the original shape BEFORE whitelist copy to prevent omitted/incorrect fields
 // from being silently transformed into numeric zeros or nulls.
 if(!isExteriorEstimate(v,leadId))throw Error('Estimate contains invalid scope or price fields.');
 const lines=(v.lines as EstimateLine[]).map(line=>({
  id:line.id,service:line.service,quantity:line.quantity,unit:line.unit,
  pricePerUnit:line.pricePerUnit,costPerUnit:line.costPerUnit,notes:line.notes,
 }));
 const estimate:ExteriorEstimate={
  schema:1,leadId,
  sourceUpdatedAt:v.sourceUpdatedAt as string|null,
  sourceQuote:v.sourceQuote as number|null,
  lines,
  discount:v.discount as number,travelCost:v.travelCost as number|null,
  contingencyPct:v.contingencyPct as number,
 };
 if(estimate.sourceUpdatedAt!==null&&!Number.isFinite(Date.parse(estimate.sourceUpdatedAt)))
  throw Error('Estimate has an invalid source timestamp.');
 computeExteriorEstimate(estimate);
 return estimate;
}
function scrubBook(raw:unknown,leadId:string):LocalEstimateBook{
 const v=obj(raw,'Estimate book');
 if(v.schema!==1||!Array.isArray(v.revisions)||v.revisions.length>8)
  throw Error('Unsupported estimate version history.');
 const revisions:LocalRevision[]=[];
 const ids=new Set<string>();
 for(const source of v.revisions){
  const item=obj(source,'Revision');
  const id=str(item.id,'Revision ID',90,true);
  if(ids.has(id))throw Error('Duplicate revision identifier.');
  ids.add(id);
  const savedAt=str(item.savedAt,'Revision time',40,true);
  dateTime(savedAt);
  revisions.push({id,savedAt,estimate:scrubEstimate(item.estimate,leadId)});
 }
 return {schema:1,current:scrubEstimate(v.current,leadId),revisions};
}
function decode(raw:unknown,org:string,leadId:string):QuoteHandoff{
 const d=obj(raw,'Quote handoff');
 if(!org||org.length>128||!leadId||leadId.length>128)throw Error('An exact destination organization and lead are required.');
 if(d.format!==quoteHandoffFormat||d.version!==quoteHandoffVersion)throw Error('Unsupported quote handoff format/version.');
 if(d.organization_id!==org)throw Error('Quote belongs to a different organization.');
 if(d.lead_id!==leadId)throw Error('Quote belongs to a different customer record.');
 if(d.status!=='internal-draft')throw Error('Unknown or unsupported customer acceptance status.');
 const exportedAt=dateTime(str(d.exported_at,'Export time',40,true));
 return {
  format:quoteHandoffFormat,version:quoteHandoffVersion,
  organization_id:org,lead_id:leadId,exported_at:exportedAt,
  status:'internal-draft',book:scrubBook(d.book,leadId),
 };
}
export function exportQuoteHandoff(org:string,book:LocalEstimateBook,when=new Date()):string{
 const candidate={
  format:quoteHandoffFormat,version:quoteHandoffVersion,
  organization_id:org,lead_id:book.current.leadId,exported_at:when.toISOString(),
  status:'internal-draft',book,
 };
 const verified=decode(candidate,org,book.current.leadId);
 const serialized=JSON.stringify(verified,null,2);
 if(serialized.length>quoteHandoffMaxChars)throw Error('Quote transfer exceeds the file size limit.');
 return serialized;
}
export function importQuoteHandoff(raw:string,org:string,leadId:string):QuoteHandoff{
 if(typeof raw!=='string'||!raw||raw.length>quoteHandoffMaxChars)throw Error('Quote file is empty or exceeds 120 KB.');
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{throw Error('Quote file is not valid JSON.');}
 return decode(parsed,org,leadId);
}
/** Never guesses that a customer accepted an internal estimate. */
export function quoteHandoffPreflight(estimate:ExteriorEstimate,lead:ExtLead,bookings:readonly ExtBooking[]):QuoteHandoffPreflight{
 const totals=computeExteriorEstimate(estimate);
 const sourceMatch=estimate.leadId===lead.id&&estimate.sourceUpdatedAt===lead.updated_at&&estimate.sourceQuote===lead.quote_amount;
 const sourcePriceMatch=lead.quote_amount!==null&&lead.quote_amount===totals.price;
 const canRecordSharedPrice=sourceMatch&&['new','contacted','following_up'].includes(lead.status??'')&&totals.price>0;
 const linkedBookingCount=bookings.filter(b=>b.lead_id===lead.id).length;
 const warnings:string[]=[];
 if(!sourceMatch)warnings.push('Source record changed since this local version. Review and rebase before recording an amount.');
 if(!sourcePriceMatch)warnings.push('Local proposed amount does not equal the source lead quote. Do not describe it as recorded.');
 if(linkedBookingCount)warnings.push('Existing bookings linked to this lead must be inspected before another appointment.');
 if(totals.cost===null)warnings.push('Some direct cost evidence is missing; margin and profitability remain unknown.');
 warnings.push('Customer acceptance, signatures, emails and verbal agreements are not verifiable from this internal file.');
 return {sourceMatch,sourcePriceMatch,canRecordSharedPrice,hasLinkedBooking:linkedBookingCount>0,
  linkedBookingCount,externalCustomerAcceptance:'unverified',warnings};
}
