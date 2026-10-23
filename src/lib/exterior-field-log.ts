import type {ExtBooking} from './exterior';

/**
 * An operator-entered, booking-bound FIELD DRAFT.
 * Not a payroll timesheet, work-order closeout, invoice, certified safety inspection,
 * bank receipt or shared company ledger. All fields are local until future verified sync.
 */
export type FieldStage='preparation'|'on-site'|'wrap-up';
export type CheckState='not-checked'|'ready'|'issue'|'not-required';
export type IssueSeverity='note'|'attention'|'stop-work';
export type FieldLabor={id:string;role:string;hours:number|null;hourlyCost:number|null;notes:string};
export type FieldMaterial={id:string;name:string;quantity:number|null;unitCost:number|null;notes:string};
export type FieldIssue={id:string;category:'equipment'|'site'|'weather'|'customer'|'other';severity:IssueSeverity;description:string;resolved:boolean};
export type FieldChecklist={
 water:CheckState;ppe:CheckState;runoff:CheckState;chemicals:CheckState;
 pump:CheckState;hoses:CheckState;pureWater:CheckState;
};
export type FieldReview={labor:boolean;materials:boolean;travel:boolean;other:boolean};
export type ExteriorFieldLog={
 schema:1;bookingId:string;leadId:string;sourceDate:string;sourceStatus:string|null;
 stage:FieldStage;arrivalAt:string|null;departureAt:string|null;
 labor:FieldLabor[];materials:FieldMaterial[];travelMiles:number|null;vehicleCostPerMile:number|null;
 otherDirectCost:number|null;review:FieldReview;checks:FieldChecklist;
 issues:FieldIssue[];siteNotes:string;
};
export type FieldCostReview={
 hours:number;knownLaborCost:number|null;knownMaterialsCost:number|null;
 knownTravelCost:number|null;knownOtherCost:number|null;
 totalDirectCost:number|null;recordedSubset:number;
 complete:boolean;issuesOpen:number;criticalIssues:number;uncheckedSafety:number;
 flags:string[];
};
export const fieldLogFormat='oj-exterior-field-draft';
export const fieldLogVersion=1;
export const fieldLogMaxChars=95000;
const states:readonly CheckState[]=['not-checked','ready','issue','not-required'];
const severity:readonly IssueSeverity[]=['note','attention','stop-work'];
const categories:readonly FieldIssue['category'][]=['equipment','site','weather','customer','other'];
const stages:readonly FieldStage[]=['preparation','on-site','wrap-up'];
const dollar=(v:unknown,max=1e6):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const opt=(v:unknown,max=1e6):v is number|null=>v===null||dollar(v,max);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
const id=(v:unknown):v is string=>text(v,128)&&Boolean((v as string).trim());
const day=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const instant=(s:unknown):s is string|null=>s===null||(typeof s==='string'&&s.length<=40&&
 /^\d{4}-\d\d-\d\dT/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s);
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const unique=(rows:{id:string}[])=>new Set(rows.map(r=>r.id)).size===rows.length;
export const fieldCheckLabels:Record<keyof FieldChecklist,string>={
 water:'Water source / customer permission',ppe:'PPE and chemical protection',
 runoff:'Wastewater and runoff controls',chemicals:'Chemical mix and exposure assessment',
 pump:'Pressure washer / pump',hoses:'Hoses, fittings and injectors',
 pureWater:'Water-fed window system',
};
export function newFieldLog(b:ExtBooking):ExteriorFieldLog{
 if(!id(b.id)||!id(b.lead_id)||!day(b.date))throw Error('An exact dated booking and its source lead are required.');
 return {schema:1,bookingId:b.id,leadId:b.lead_id!,sourceDate:b.date,sourceStatus:b.status,
  stage:'preparation',arrivalAt:null,departureAt:null,
  labor:[],materials:[],travelMiles:null,vehicleCostPerMile:null,otherDirectCost:null,
  review:{labor:false,materials:false,travel:false,other:false},
  checks:{water:'not-checked',ppe:'not-checked',runoff:'not-checked',chemicals:'not-checked',
   pump:'not-checked',hoses:'not-checked',pureWater:'not-checked'},
  issues:[],siteNotes:''};
}
export function isFieldLog(v:unknown,expectedBooking?:string,expectedLead?:string):v is ExteriorFieldLog{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const d=v as Partial<ExteriorFieldLog>;
 if(d.schema!==1||!id(d.bookingId)||!id(d.leadId)||expectedBooking&&d.bookingId!==expectedBooking||
    expectedLead&&d.leadId!==expectedLead||!day(d.sourceDate)||!(d.sourceStatus===null||text(d.sourceStatus,80))||
    !stages.includes(d.stage as FieldStage)||!instant(d.arrivalAt)||!instant(d.departureAt)||
    d.arrivalAt&&d.departureAt&&Date.parse(d.departureAt)<Date.parse(d.arrivalAt)||
    !opt(d.travelMiles,10000)||!opt(d.vehicleCostPerMile,100)||!opt(d.otherDirectCost,1e7)||
    !text(d.siteNotes,4000))return false;
 if(!Array.isArray(d.labor)||d.labor.length>20||!Array.isArray(d.materials)||d.materials.length>30||
    !Array.isArray(d.issues)||d.issues.length>25)return false;
 if(!unique(d.labor)||!unique(d.materials)||!unique(d.issues))return false;
 for(const row of d.labor)if(!id(row.id)||!text(row.role,90)||!row.role.trim()||!opt(row.hours,200)||
  !opt(row.hourlyCost,10000)||!text(row.notes,500))return false;
 for(const row of d.materials)if(!id(row.id)||!text(row.name,100)||!row.name.trim()||
  !opt(row.quantity,100000)||!opt(row.unitCost,1e6)||!text(row.notes,500))return false;
 for(const issue of d.issues)if(!id(issue.id)||!categories.includes(issue.category)||
  !severity.includes(issue.severity)||!text(issue.description,800)||!issue.description.trim()||
  typeof issue.resolved!=='boolean')return false;
 if(!d.review||['labor','materials','travel','other'].some(x=>typeof d.review![x as keyof FieldReview]!=='boolean'))return false;
 if(!d.checks||Object.keys(fieldCheckLabels).some(x=>!states.includes(d.checks![x as keyof FieldChecklist])))return false;
 return true;
}
export function reviewFieldLog(log:ExteriorFieldLog):FieldCostReview{
 if(!isFieldLog(log))throw Error('Field data are invalid. Review the incomplete entries.');
 const hours=money(log.labor.reduce((s,l)=>s+(l.hours??0),0));
 const knownLaborCost=log.review.labor&&log.labor.every(l=>l.hours!==null&&l.hourlyCost!==null)
  ?money(log.labor.reduce((s,l)=>s+(l.hours??0)*(l.hourlyCost??0),0)):null;
 const knownMaterialsCost=log.review.materials&&log.materials.every(m=>m.quantity!==null&&m.unitCost!==null)
  ?money(log.materials.reduce((s,m)=>s+(m.quantity??0)*(m.unitCost??0),0)):null;
 const knownTravelCost=log.review.travel&&log.travelMiles!==null&&log.vehicleCostPerMile!==null
  ?money(log.travelMiles*log.vehicleCostPerMile):null;
 const knownOtherCost=log.review.other&&log.otherDirectCost!==null?money(log.otherDirectCost):null;
 const parts=[knownLaborCost,knownMaterialsCost,knownTravelCost,knownOtherCost];
 const complete=parts.every(p=>p!==null);
 const totalDirectCost=complete?money(parts.reduce<number>((s,n)=>s+(n??0),0)):null;
 const recordedSubset=money(parts.reduce<number>((s,n)=>s+(n??0),0));
 const open=log.issues.filter(i=>!i.resolved);
 const safety=['water','ppe','runoff','chemicals'] as const;
 const uncheckedSafety=safety.filter(k=>log.checks[k]==='not-checked').length;
 const flags:string[]=[];
 if(!log.arrivalAt||!log.departureAt)flags.push('Arrival/departure evidence is incomplete.');
 if(uncheckedSafety)flags.push(uncheckedSafety+' site-safety checks have not been reviewed.');
 if(safety.some(k=>log.checks[k]==='issue'))flags.push('A site safety item requires attention; this is not a clearance to operate.');
 if(open.some(i=>i.severity==='stop-work'))flags.push('An unresolved stop-work issue is recorded.');
 if(!complete)flags.push('Some labor, materials, travel or additional direct costs are not reviewed; job cost is unknown.');
 flags.push('No verified booking-specific revenue, invoice, customer signoff, or bank payment is captured here.');
 return {hours,knownLaborCost,knownMaterialsCost,knownTravelCost,knownOtherCost,
  totalDirectCost,recordedSubset,complete,issuesOpen:open.length,criticalIssues:open.filter(i=>i.severity==='stop-work').length,
  uncheckedSafety,flags};
}
/** Importing a log MUST NOT automatically mark any appointment completed. */
export function fieldSourceMatches(log:ExteriorFieldLog,booking:ExtBooking):boolean{
 return booking.id===log.bookingId&&booking.lead_id===log.leadId&&booking.date===log.sourceDate&&
  booking.status===log.sourceStatus;
}
function clone(v:ExteriorFieldLog):ExteriorFieldLog{
 return {
  schema:1,bookingId:v.bookingId,leadId:v.leadId,sourceDate:v.sourceDate,sourceStatus:v.sourceStatus,
  stage:v.stage,arrivalAt:v.arrivalAt,departureAt:v.departureAt,
  labor:v.labor.map(l=>({id:l.id,role:l.role,hours:l.hours,hourlyCost:l.hourlyCost,notes:l.notes})),
  materials:v.materials.map(m=>({id:m.id,name:m.name,quantity:m.quantity,unitCost:m.unitCost,notes:m.notes})),
  travelMiles:v.travelMiles,vehicleCostPerMile:v.vehicleCostPerMile,otherDirectCost:v.otherDirectCost,
  review:{labor:v.review.labor,materials:v.review.materials,travel:v.review.travel,other:v.review.other},
  checks:{water:v.checks.water,ppe:v.checks.ppe,runoff:v.checks.runoff,chemicals:v.checks.chemicals,
   pump:v.checks.pump,hoses:v.checks.hoses,pureWater:v.checks.pureWater},
  issues:v.issues.map(i=>({id:i.id,category:i.category,severity:i.severity,description:i.description,resolved:i.resolved})),
  siteNotes:v.siteNotes};
}
export function serializeFieldPackage(org:string,log:ExteriorFieldLog,when=new Date()):string{
 if(!id(org)||!isFieldLog(log)||!Number.isFinite(when.getTime()))throw Error('Cannot export an invalid booking log.');
 const data={format:fieldLogFormat,version:fieldLogVersion,organization_id:org,
  booking_id:log.bookingId,lead_id:log.leadId,exported_at:when.toISOString(),
  status:'internal-field-draft',log:clone(log)};
 const json=JSON.stringify(data,null,2);
 if(json.length>fieldLogMaxChars)throw Error('Field record exceeds the supported file size.');
 return json;
}
export function parseFieldPackage(raw:string,org:string,bookingId:string,leadId:string):ExteriorFieldLog{
 if(typeof raw!=='string'||!raw||raw.length>fieldLogMaxChars)throw Error('Field package is empty or too large.');
 let val:unknown;
 try{val=JSON.parse(raw);}catch{throw Error('Field package is not valid JSON.');}
 if(!val||typeof val!=='object'||Array.isArray(val))throw Error('Invalid field package.');
 const d=val as Record<string,unknown>;
 if(d.format!==fieldLogFormat||d.version!==fieldLogVersion||d.status!=='internal-field-draft')throw Error('Unsupported or falsely finalized field record.');
 if(d.organization_id!==org)throw Error('Field package belongs to another organization.');
 if(d.booking_id!==bookingId||d.lead_id!==leadId)throw Error('Field package belongs to another booking/customer.');
 if(typeof d.exported_at!=='string'||!instant(d.exported_at))throw Error('Export timestamp is invalid.');
 if(!isFieldLog(d.log,bookingId,leadId))throw Error('Field package contains invalid work or cost evidence.');
 const result=clone(d.log);
 reviewFieldLog(result);
 return result;
}
