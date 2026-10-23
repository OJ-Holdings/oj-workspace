import type { EstimateInput } from './commercial-estimate';
import { exportCommercialEstimate, importCommercialEstimate } from './commercial-transfer';
import type { ExtBooking } from './exterior';
import type { FleetWorkbook } from './fleet-command';
import { assetHealth, validDay } from './fleet-command';
import { validateFieldCrewPlan, type FieldCrewPlan } from './atlas-field-mission';

/**
 * This is a VERSIONED DEVICE-LOCAL project portfolio, deliberately separate from
 * the authorized Supabase sources. A linked booking ID is only an assertion until
 * resolved against CURRENTLY LOADED source bookings. Planned asset IDs are not
 * dispatch assignments, equipment locks, inventory sync, or rental reservations.
 */
export const portfolioFormat='oj-commercial-portfolio-local-v1' as const;
export const portfolioVersion=1 as const;
export const portfolioLimit=24;
export const portfolioMaxBytes=1024*1024;
export const projectPhases=['scoping','founder-review','archived'] as const;
export type ProjectPhase=typeof projectPhases[number];

export type CommercialProject={
  id:string;revision:number;createdAt:string;updatedAt:string;
  name:string;input:EstimateInput;review:boolean[];
  phase:ProjectPhase;
  bookingId:string|null;
  plannedAssetIds:string[];
  /** Optional on pre-R11 exports; normalized to UNKNOWN model values when read. */
  fieldCrewPlan?:FieldCrewPlan;
};
export type CommercialPortfolio={
  format:typeof portfolioFormat;version:typeof portfolioVersion;
  organizationId:string;revision:number;
  projects:CommercialProject[];
};
export type ProjectDraft=Pick<CommercialProject,'name'|'input'|'review'|'phase'|'bookingId'|'plannedAssetIds'|'fieldCrewPlan'>;
export type BookingEvidence={
  state:'unlinked'|'loaded-active'|'loaded-inactive'|'not-loaded';
  booking:ExtBooking|null;label:string;
};
export type EquipmentEvidence={
  id:string;name:string;state:'missing'|'out-of-service'|'needs-service'|'due'|'due-soon'|'unverified'|'recorded-ready';
};
export type ResourceFinding={id:string;severity:'attention'|'review'|'unknown';text:string};

const obj=(v:unknown,label:string):Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(label+' must be an object.');
  return v as Record<string,unknown>;
};
const identifier=(v:unknown,label:string):string=>{
  if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(v))throw new Error('Invalid '+label+'.');
  return v;
};
const utc=(v:unknown,label:string):string=>{
  if(typeof v!=='string'||v.length>40||!/^\d{4}-\d\d-\d\dT/.test(v)||
    !Number.isFinite(Date.parse(v)))throw new Error('Invalid '+label+'.');
  return new Date(v).toISOString();
};
const revision=(v:unknown,label:string):number=>{
  if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>100000000)throw new Error('Invalid '+label+'.');
  return v;
};
const uuid=(v:unknown):string|null=>{
  if(v===null)return null;
  if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)){
    throw new Error('Linked booking must be a source UUID, not a guessed name or address.');
  }
  return v.toLowerCase();
};
function validatedDraft(raw:unknown,org:string):ProjectDraft{
  const record=obj(raw,'Project');
  const phase=record.phase;
  if(typeof phase!=='string'||!projectPhases.includes(phase as ProjectPhase)){
    throw new Error('Invalid project workflow phase.');
  }
  if(!Array.isArray(record.plannedAssetIds)||record.plannedAssetIds.length>40)throw new Error('Too many planned assets.');
  const plannedAssetIds=record.plannedAssetIds.map(x=>identifier(x,'planned asset ID'));
  if(new Set(plannedAssetIds).size!==plannedAssetIds.length)throw new Error('Duplicate planned asset IDs.');
  // Canonical, whitelisted, org-scoped estimate parser protects every input.
  const serialized=exportCommercialEstimate(org,record.name as string,record.input as EstimateInput,record.review as boolean[]);
  const normalized=importCommercialEstimate(serialized,org);
  return {
    name:normalized.name,input:normalized.input,review:normalized.review,
    phase:phase as ProjectPhase,bookingId:uuid(record.bookingId),
    plannedAssetIds,
    fieldCrewPlan:validateFieldCrewPlan(record.fieldCrewPlan),
  };
}
const validateProject=(raw:unknown,org:string):CommercialProject=>{
  const x=obj(raw,'Project');
  const id=identifier(x.id,'project ID');
  const createdAt=utc(x.createdAt,'creation time');
  const updatedAt=utc(x.updatedAt,'update time');
  if(updatedAt<createdAt)throw new Error('Project update predates creation.');
  return {
    id,revision:revision(x.revision,'project revision'),createdAt,updatedAt,
    ...validatedDraft(x,org),
  };
};
export const emptyCommercialPortfolio=(org:string):CommercialPortfolio=>({
  format:portfolioFormat,version:portfolioVersion,organizationId:identifier(org,'organization'),
  revision:0,projects:[],
});
export function validateCommercialPortfolio(raw:unknown,org:string):CommercialPortfolio{
  const x=obj(raw,'Commercial portfolio');
  identifier(org,'organization');
  if(x.format!==portfolioFormat||x.version!==portfolioVersion)throw new Error('Unsupported project portfolio format.');
  if(x.organizationId!==org)throw new Error('This project portfolio belongs to another workspace organization.');
  if(!Array.isArray(x.projects)||x.projects.length>portfolioLimit)throw new Error('Project limit exceeded.');
  const projects=x.projects.map(p=>validateProject(p,org));
  if(new Set(projects.map(p=>p.id)).size!==projects.length)throw new Error('Duplicate project IDs.');
  return {
    format:portfolioFormat,version:portfolioVersion,organizationId:org,
    revision:revision(x.revision,'portfolio revision'),projects,
  };
}
export function encodeCommercialPortfolio(value:CommercialPortfolio,org:string):string{
  const clean=validateCommercialPortfolio(value,org);
  const json=JSON.stringify(clean,null,2);
  if(new TextEncoder().encode(json).byteLength>portfolioMaxBytes)throw new Error('Private project portfolio exceeds 1 MB.');
  return json;
}
export function decodeCommercialPortfolio(json:string,org:string):CommercialPortfolio{
  if(typeof json!=='string'||json.length===0||new TextEncoder().encode(json).byteLength>portfolioMaxBytes){
    throw new Error('Private portfolio is empty or exceeds 1 MB.');
  }
  let raw:unknown;
  try{raw=JSON.parse(json);}catch{throw new Error('Portfolio is not valid JSON.');}
  return validateCommercialPortfolio(raw,org);
}
/** Does not mutate supplied portfolio. The caller supplies the new project ID,
 * expected project revision and timestamp; stale tabs are rejected, not merged.
 */
export function savePortfolioProject(
  portfolio:CommercialPortfolio,org:string,id:string,draft:ProjectDraft,
  expectedRevision:number|null,at:string,
):CommercialPortfolio{
  const current=validateCommercialPortfolio(portfolio,org);
  identifier(id,'project ID');
  const now=utc(at,'save time');
  const normalized=validatedDraft(draft,org);
  const found=current.projects.find(p=>p.id===id);
  if(found && found.revision!==expectedRevision)throw new Error('Project changed in another tab. Reload before saving.');
  if(!found && expectedRevision!==null)throw new Error('Project no longer exists. Reload before saving.');
  if(!found && current.projects.length>=portfolioLimit)throw new Error('This browser already has 24 projects.');
  const next:CommercialProject={
    id,revision:(found?.revision??0)+1,createdAt:found?.createdAt??now,
    updatedAt:now,...normalized,
  };
  if(found && now<found.createdAt)throw new Error('Invalid update timestamp.');
  return {
    ...current,revision:current.revision+1,
    projects:found?current.projects.map(p=>p.id===id?next:p):[...current.projects,next],
  };
}
export function deletePortfolioProject(
  portfolio:CommercialPortfolio,org:string,id:string,expectedRevision:number,
):CommercialPortfolio{
  const current=validateCommercialPortfolio(portfolio,org);
  const found=current.projects.find(p=>p.id===id);
  if(!found||found.revision!==expectedRevision)throw new Error('Project changed or is unavailable. Reload before deleting.');
  return {...current,revision:current.revision+1,projects:current.projects.filter(p=>p.id!==id)};
}
export function resolveSourceBooking(id:string|null,loaded:readonly ExtBooking[]):BookingEvidence{
  if(id===null)return {state:'unlinked',booking:null,label:'No source booking explicitly linked'};
  uuid(id);
  const matched=loaded.find(b=>b.id.toLowerCase()===id.toLowerCase());
  if(!matched)return {state:'not-loaded',booking:null,label:'Source booking not present in currently loaded records'};
  const inactive=matched.status==='cancelled'||matched.status==='denied';
  return {
    state:inactive?'loaded-inactive':'loaded-active',booking:matched,
    label:inactive?'Recorded booking is cancelled or denied':'Exact source booking ID found (status still requires review)',
  };
}
export function projectEquipmentEvidence(
  project:CommercialProject,fleet:FleetWorkbook|null,day:string,
):EquipmentEvidence[]{
  return project.plannedAssetIds.map(id=>{
    const asset=fleet?.assets.find(a=>a.id===id);
    if(!asset)return {id,name:'Local asset not loaded on this device',state:'missing' as const};
    const health=assetHealth(asset,day);
    const state:EquipmentEvidence['state']=health==='monitor'?'unverified':
      health==='ready'?'recorded-ready':health;
    return {id,name:asset.name,state};
  });
}
export function resourcePlanFindings(
  selected:CommercialProject,projects:readonly CommercialProject[],
  fleet:FleetWorkbook|null,bookings:readonly ExtBooking[],day:string,
):ResourceFinding[]{
  const issues:ResourceFinding[]=[];
  const booking=resolveSourceBooking(selected.bookingId,bookings);
  if(booking.state==='unlinked')issues.push({id:'booking-unlinked',severity:'unknown',text:'No exact Exterior booking ID linked; this project is not established as scheduled work.'});
  if(booking.state==='not-loaded')issues.push({id:'booking-unloaded',severity:'unknown',text:'Linked booking is not among authorized loaded records; existence and status are unverified.'});
  if(booking.state==='loaded-inactive')issues.push({id:'booking-inactive',severity:'attention',text:'The explicitly linked source booking is cancelled or denied. Do not dispatch against it.'});
  if(selected.plannedAssetIds.length===0)issues.push({id:'no-equipment',severity:'unknown',text:'No equipment has been selected for this local planning scenario.'});
  if(!fleet && selected.plannedAssetIds.length>0)issues.push({id:'no-fleet',severity:'unknown',text:'Fleet workbook is unavailable here. Assigned asset IDs are unverified.'});
  for(const asset of projectEquipmentEvidence(selected,fleet,day)){
    if(asset.state==='missing'||asset.state==='unverified')issues.push({id:'asset-'+asset.id,severity:'unknown',text:asset.name+' — asset '+asset.id+' is missing or lacks service status evidence.'});
    if(['out-of-service','needs-service','due'].includes(asset.state))issues.push({id:'asset-'+asset.id,severity:'attention',text:asset.name+' is recorded '+asset.state+'; review before any field assignment.'});
    if(asset.state==='due-soon')issues.push({id:'asset-'+asset.id,severity:'review',text:asset.name+' is nearing an entered service threshold.'});
  }
  // Same-day plans are possible contention, NOT proven time-overlap or dispatch.
  if(booking.booking&&validDay(booking.booking.date)){
    const other=projects.filter(p=>p.id!==selected.id && p.phase!=='archived' && p.bookingId!==null);
    for(const p of other){
      const otherBooking=resolveSourceBooking(p.bookingId,bookings);
      if(otherBooking.state!=='loaded-active'||!otherBooking.booking||otherBooking.booking.id===booking.booking.id||otherBooking.booking.date!==booking.booking.date)continue;
      const common=selected.plannedAssetIds.filter(id=>p.plannedAssetIds.includes(id));
      if(common.length)issues.push({id:'asset-conflict-'+p.id,severity:'review',text:common.length+' planned asset(s) also appear on another project with a different loaded booking on the same calendar date. Times and actual reservations are NOT verified.'});
    }
  }
  return issues;
}
