import type {ExtBooking} from './exterior';
import {
 assetHealth,calculateRigLoad,readinessItems,validDay,validateFleet,
 type FleetWorkbook,type FleetAsset,type AssetHealth,
} from './fleet-command';
import {chicagoDateOf} from './atlas-field-bridge';

export const EQUIPMENT_PLAN_FORMAT='oj-field-equipment-local-v1';
export type FieldEquipmentPlan={
 format:typeof EQUIPMENT_PLAN_FORMAT;organizationId:string;bookingId:string;leadId:string;
 sourceDate:string;sourceStatus:string|null;
 selectedAssetIds:string[];reviewedAt:string|null;
};
export type FieldEquipmentFinding={type:'stop'|'attention'|'unknown';message:string};
export type FieldEquipmentAssessment={
 sourceMatches:boolean;fleetAvailable:boolean;assigned:{asset:FleetAsset;health:AssetHealth}[];
 missingIds:string[];sameDayConflicts:{assetId:string;name:string;bookingIds:string[]}[];
 reviewedToday:boolean;fleetChecklistFresh:boolean;
 fleetChecklistChecked:number;fleetChecklistTotal:number;
 capacityRemainingLb:number|null;knownPayloadOverage:boolean;
 findings:FieldEquipmentFinding[];
};
const id=(s:unknown,max=100)=>typeof s==='string'&&s.length>0&&s.length<=max&&/^[\w-]+$/.test(s);
const iso=(s:unknown)=>s===null||(typeof s==='string'&&s.length<=40&&
 Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s);
const status=(s:unknown)=>s===null||(typeof s==='string'&&s.length<=80);
export function equipmentPlanKey(org:string,bid:string):string{
 if(!id(org)||!id(bid))throw Error('Invalid organization or booking ID.');
 return `oj-exterior-field-equipment-v1:${org}:${bid}`;
}
export function makeEquipmentPlan(org:string,booking:ExtBooking):FieldEquipmentPlan{
 if(!id(org)||!id(booking.id)||!id(booking.lead_id)||!validDay(booking.date)||
  !status(booking.status))throw Error('Exact source booking is required.');
 return {format:EQUIPMENT_PLAN_FORMAT,organizationId:org,bookingId:booking.id,
  leadId:booking.lead_id!,sourceDate:booking.date,sourceStatus:booking.status,
  selectedAssetIds:[],reviewedAt:null};
}
/** Validated source-bound assignment; intentionally never a shared/confirmed dispatch record. */
export function parseEquipmentPlan(raw:string,org:string,booking:ExtBooking):FieldEquipmentPlan{
 if(typeof raw!=='string'||raw.length>20000)throw Error('Job equipment plan is too large.');
 let v:unknown;
 try{v=JSON.parse(raw);}catch{throw Error('Invalid job equipment plan JSON.');}
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid job equipment plan.');
 const d=v as Record<string,unknown>;
 if(d.format!==EQUIPMENT_PLAN_FORMAT||d.organizationId!==org||
   d.bookingId!==booking.id||d.leadId!==booking.lead_id)throw Error('Job equipment plan belongs to another company or booking.');
 if(!validDay(d.sourceDate)||!status(d.sourceStatus)||!iso(d.reviewedAt))throw Error('Job equipment plan contains invalid source evidence.');
 if(!Array.isArray(d.selectedAssetIds)||d.selectedAssetIds.length>30||
    d.selectedAssetIds.some(x=>!id(x,80))||
    new Set(d.selectedAssetIds).size!==d.selectedAssetIds.length)throw Error('Invalid or duplicate job equipment IDs.');
 return {format:EQUIPMENT_PLAN_FORMAT,organizationId:org,bookingId:booking.id,leadId:booking.lead_id!,
  sourceDate:d.sourceDate as string,sourceStatus:d.sourceStatus as string|null,
  selectedAssetIds:[...d.selectedAssetIds] as string[],reviewedAt:d.reviewedAt as string|null};
}
export function encodeEquipmentPlan(plan:FieldEquipmentPlan,org:string,booking:ExtBooking):string{
 return JSON.stringify(parseEquipmentPlan(JSON.stringify(plan),org,booking));
}
export function evaluateEquipmentPlan(
 plan:FieldEquipmentPlan,booking:ExtBooking,fleet:FleetWorkbook|null,
 others:readonly {booking:ExtBooking;plan:FieldEquipmentPlan}[],today:string,
):FieldEquipmentAssessment{
 const checked=parseEquipmentPlan(JSON.stringify(plan),plan.organizationId,booking);
 const sourceMatches=booking.id===checked.bookingId&&booking.lead_id===checked.leadId&&
  booking.date===checked.sourceDate&&booking.status===checked.sourceStatus;
 const reviewedToday=!!checked.reviewedAt&&chicagoDateOf(checked.reviewedAt)===today;
 const findings:FieldEquipmentFinding[]=[];
 if(!sourceMatches) findings.push({type:'attention',message:'Booking date/status changed. Revalidate the job assignment against the original source.'});
 if(!reviewedToday)findings.push({type:'unknown',message:'No same-day operator equipment review is recorded. Old checks cannot clear a new field shift.'});
 if(booking.status==='denied'||booking.status==='cancelled')findings.push({type:'stop',message:'This source booking is cancelled/denied. Do not treat it as scheduled active work.'});
 if(!fleet){
  findings.push({type:'unknown',message:'The Fleet Command workbook is not accessible on this browser. No equipment status can be verified.'});
  return {sourceMatches,fleetAvailable:false,assigned:[],missingIds:[...checked.selectedAssetIds],
   sameDayConflicts:[],reviewedToday,fleetChecklistFresh:false,
   fleetChecklistChecked:0,fleetChecklistTotal:readinessItems.length,
   capacityRemainingLb:null,knownPayloadOverage:false,findings};
 }
 const validated=validateFleet(fleet,plan.organizationId);
 const assigned=checked.selectedAssetIds.flatMap(assetId=>{
  const a=validated.assets.find(x=>x.id===assetId);
  return a?[{asset:a,health:assetHealth(a,today)}]:[];
 });
 const missingIds=checked.selectedAssetIds.filter(x=>!assigned.some(a=>a.asset.id===x));
 if(missingIds.length)findings.push({type:'attention',message:'Assigned equipment IDs are missing from this local Fleet Command workbook.'});
 if(!checked.selectedAssetIds.length)findings.push({type:'unknown',message:'No equipment selected for this job. This does not imply an equipment-free scope.'});
 const sameDayConflicts=assigned.flatMap(row=>{
  const conflictBookings=others.filter(o=>o.booking.id!==booking.id&&o.booking.date===booking.date&&
    !['cancelled','denied'].includes(o.booking.status??'')&&
    o.plan.organizationId===plan.organizationId&&o.plan.bookingId===o.booking.id&&
    o.plan.leadId===o.booking.lead_id&&o.plan.sourceDate===o.booking.date&&
    o.plan.selectedAssetIds.includes(row.asset.id)).map(o=>o.booking.id);
  return conflictBookings.length?[{assetId:row.asset.id,name:row.asset.name,bookingIds:conflictBookings}]:[];
 });
 if(sameDayConflicts.length)findings.push({type:'attention',message:'An asset is planned on another booking the same day. Times and physical overlap are NOT independently verified.'});
 for(const {asset,health} of assigned){
  if(['out-of-service','needs-service','due'].includes(health))
   findings.push({type:'stop',message:asset.name+' is locally recorded '+health+'. Inspect/repair before use; plan is not cleared.'});
  else if(health==='due-soon'||health==='monitor')findings.push({type:'unknown',message:asset.name+' has '+health+' maintenance confidence. Verify its actual condition.'});
 }
 const fleetChecklistFresh=!!validated.readiness.updatedAt&&chicagoDateOf(validated.readiness.updatedAt)===today;
 const fleetChecklistChecked=fleetChecklistFresh?validated.readiness.checked.length:0;
 if(!fleetChecklistFresh||fleetChecklistChecked!==readinessItems.length)findings.push({type:'unknown',message:'Fleet pre-departure checklist is incomplete or from another day; each job still needs its own safety review.'});
 const capacity=calculateRigLoad(validated.rig);
 if(capacity.exceedsEnteredPayload)findings.push({type:'stop',message:'Entered rig load exceeds entered vehicle payload. Resolve the load before travel.'});
 else if(!capacity.hasVehicleCapacity)findings.push({type:'unknown',message:'Vehicle payload capacity is not entered in Fleet Command. Safe carrying capacity is unverified.'});
 return {sourceMatches,fleetAvailable:true,assigned,missingIds,sameDayConflicts,reviewedToday,
  fleetChecklistFresh,fleetChecklistChecked,fleetChecklistTotal:readinessItems.length,
  capacityRemainingLb:capacity.remainingLb,knownPayloadOverage:capacity.exceedsEnteredPayload,findings};
}
