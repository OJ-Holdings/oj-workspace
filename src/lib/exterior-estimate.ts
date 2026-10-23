import type {ExtLead} from './exterior';

/** A local estimate is a private internal scenario, never a proposal or an invoice. */
export type EstimateUnit='flat'|'each'|'sqft'|'linear_ft'|'pane'|'hour';
export type EstimateLine={id:string;service:string;quantity:number;unit:EstimateUnit;pricePerUnit:number;costPerUnit:number|null;notes:string};
export type ExteriorEstimate={
 schema:1;leadId:string;sourceUpdatedAt:string|null;sourceQuote:number|null;
 lines:EstimateLine[];discount:number;travelCost:number|null;contingencyPct:number;
};
export type LocalRevision={id:string;savedAt:string;estimate:ExteriorEstimate};
export type LocalEstimateBook={schema:1;current:ExteriorEstimate;revisions:LocalRevision[]};
export type ExteriorEstimateTotals={
 subtotal:number;discount:number;price:number;cost:number|null;contribution:number|null;marginPct:number|null;
 pricedLines:number;costedLines:number;travelKnown:boolean;
};
const finite=(n:unknown,max:number):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
const units:readonly EstimateUnit[]=['flat','each','sqft','linear_ft','pane','hour'];
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const amount=(n:number)=>cents(n);

export function newExteriorEstimate(lead:ExtLead):ExteriorEstimate{
 return {
  schema:1,leadId:lead.id,sourceUpdatedAt:lead.updated_at,sourceQuote:lead.quote_amount,
  lines:[{id:'line-1',service:lead.service_requested?.trim().slice(0,120)||'Exterior service',quantity:1,
    unit:'flat',pricePerUnit:finite(lead.quote_amount,1e7)?lead.quote_amount:0,costPerUnit:null,notes:''}],
  discount:0,travelCost:null,contingencyPct:0,
 };
}
/**
 * Validates untrusted browser storage and human input. Deliberately refuses
 * unknown or grossly excessive values instead of silently coercing to zero.
 */
export function isExteriorEstimate(v:unknown,expectedLeadId?:string):v is ExteriorEstimate{
 if(!v||typeof v!=='object')return false;
 const x=v as Partial<ExteriorEstimate>;
 if(x.schema!==1||typeof x.leadId!=='string'||x.leadId.length>128||!x.leadId||expectedLeadId&&x.leadId!==expectedLeadId)return false;
 if(x.sourceUpdatedAt!==null&&typeof x.sourceUpdatedAt!=='string')return false;
 if(x.sourceQuote!==null&&!finite(x.sourceQuote,1e7))return false;
 if(!Array.isArray(x.lines)||x.lines.length<1||x.lines.length>24)return false;
 const ids=new Set<string>();
 for(const line of x.lines){
  if(!line||typeof line!=='object'||typeof line.id!=='string'||line.id.length>80||!line.id||ids.has(line.id))return false;
  ids.add(line.id);
  if(typeof line.service!=='string'||!line.service.trim()||line.service.length>120||!units.includes(line.unit))return false;
  if(!finite(line.quantity,100000)||line.quantity<=0||!finite(line.pricePerUnit,1e6)||line.costPerUnit!==null&&!finite(line.costPerUnit,1e6))return false;
  if(typeof line.notes!=='string'||line.notes.length>800)return false;
 }
 return finite(x.discount,1e7)&&finite(x.contingencyPct,100)&&
  (x.travelCost===null||finite(x.travelCost,1e6));
}
export function computeExteriorEstimate(estimate:ExteriorEstimate):ExteriorEstimateTotals{
 if(!isExteriorEstimate(estimate))throw Error('Invalid estimate. Check the line items before calculating.');
 const subtotal=amount(estimate.lines.reduce((s,l)=>s+l.quantity*l.pricePerUnit,0));
 if(subtotal>1e7)throw Error('Estimate exceeds the supported amount.');
 if(estimate.discount>subtotal)throw Error('Discount cannot exceed the subtotal.');
 const price=amount(subtotal-estimate.discount);
 if(price>1e7)throw Error('Estimate exceeds the supported amount.');
 const costedLines=estimate.lines.filter(l=>l.costPerUnit!==null).length;
 const travelKnown=estimate.travelCost!==null;
 const cost=costedLines===estimate.lines.length&&travelKnown
  ?amount((estimate.travelCost??0)+estimate.lines.reduce((s,l)=>s+l.quantity*(l.costPerUnit??0),0)*
    (1+estimate.contingencyPct/100)):null;
 const contribution=cost===null?null:amount(price-cost);
 const marginPct=contribution===null||price===0?null:amount(contribution/price*100);
 return {subtotal,discount:estimate.discount,price,cost,contribution,marginPct,
  pricedLines:estimate.lines.length,costedLines,travelKnown};
}
export function newEstimateLine(id:string):EstimateLine{
 return {id,service:'Exterior service',quantity:1,unit:'flat',pricePerUnit:0,costPerUnit:null,notes:''};
}
export function sourceStillMatches(estimate:ExteriorEstimate,lead:ExtLead):boolean{
 return estimate.leadId===lead.id&&estimate.sourceUpdatedAt===lead.updated_at&&estimate.sourceQuote===lead.quote_amount;
}
export function rebaseEstimateOnLead(estimate:ExteriorEstimate,lead:ExtLead):ExteriorEstimate{
 if(estimate.leadId!==lead.id)throw Error('Cannot rebase an estimate onto another customer.');
 return {...estimate,sourceUpdatedAt:lead.updated_at,sourceQuote:lead.quote_amount};
}
export function parseLocalEstimateBook(raw:string,leadId:string):LocalEstimateBook{
 if(raw.length>120000)throw Error('This browser draft exceeds the supported size.');
 const v:unknown=JSON.parse(raw);
 if(!v||typeof v!=='object')throw Error('Invalid local estimate record.');
 const b=v as Partial<LocalEstimateBook>;
 if(b.schema!==1||!isExteriorEstimate(b.current,leadId)||!Array.isArray(b.revisions)||b.revisions.length>12)throw Error('Invalid local estimate record.');
 for(const r of b.revisions){
  if(!r||typeof r.id!=='string'||r.id.length>90||typeof r.savedAt!=='string'||!Number.isFinite(Date.parse(r.savedAt))||!isExteriorEstimate(r.estimate,leadId))throw Error('Invalid local estimate revision.');
 }
 return b as LocalEstimateBook;
}
export function addLocalRevision(book:LocalEstimateBook,now:string,id:string):LocalEstimateBook{
 if(!isExteriorEstimate(book.current))throw Error('Cannot save invalid estimate.');
 computeExteriorEstimate(book.current);
 if(!Number.isFinite(Date.parse(now))||!id||id.length>90)throw Error('Invalid revision identity.');
 const revised:LocalRevision={id,savedAt:now,estimate:JSON.parse(JSON.stringify(book.current)) as ExteriorEstimate};
 return {schema:1,current:book.current,revisions:[revised,...book.revisions].slice(0,8)};
}
export function estimateBrief(estimate:ExteriorEstimate,lead:Pick<ExtLead,'name'|'address'>):string{
 const total=computeExteriorEstimate(estimate);
 const money=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 return [
  'OJ EXTERIOR CARE — INTERNAL ESTIMATE REVIEW',
  'NOT A CLIENT PROPOSAL, ACCEPTED CONTRACT, INVOICE OR COLLECTION RECEIPT',
  'Source record ID: '+estimate.leadId,
  'Customer: '+(lead.name??'Not entered'), 'Service address: '+(lead.address??'Not entered'),'',
  ...estimate.lines.map((l,i)=>`${i+1}. ${l.service} | ${l.quantity} ${l.unit} × ${money(l.pricePerUnit)} = ${money(amount(l.quantity*l.pricePerUnit))} | cost/unit: ${money(l.costPerUnit)}${l.notes?' | '+l.notes:''}`),
  '',
  'Subtotal: '+money(total.subtotal),
  'Proposed discount: '+money(total.discount),
  'INTERNAL PROPOSED PRICE: '+money(total.price),
  'Known total cost: '+money(total.cost),
  'Known contribution: '+money(total.contribution),
  'Margin: '+(total.marginPct===null?'Unknown':total.marginPct+'%'),
  'Cost coverage: '+total.costedLines+'/'+total.pricedLines+' items; travel '+(total.travelKnown?'entered':'unknown'),
  'Pricing source stamp: '+(estimate.sourceUpdatedAt??'unknown')+' / previous price '+money(estimate.sourceQuote),
  'Before sending anything: confirm scope, access, risk, exclusions, final price, tax treatment and customer approval.',
 ].join('\n');
}
