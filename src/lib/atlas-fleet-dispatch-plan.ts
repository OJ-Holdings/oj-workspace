import type { Card } from './board';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { CommercialPortfolio } from './atlas-commercial-portfolio';
import { calculateEstimate, type EstimateResult } from './commercial-estimate';
import { projectEquipmentEvidence } from './atlas-commercial-portfolio';
import { exactLocalProjectIds } from './atlas-task-handoff';
import type { FleetWorkbook } from './fleet-command';
import { validDay } from './fleet-command';
import { emptyFieldCrewPlan, fieldCrewCapacity, type CrewCapacity } from './atlas-field-mission';

/**
 * Read-only fleet planning projection. Source bookings must be CURRENTLY LOADED
 * for this organization. The source data is truncated by its original loader,
 * so unavailable is UNKNOWN, not evidence that a booking never existed.
 *
 * A tentative asset used in two same-day plans is a REVIEW warning, not a
 * confirmed time conflict, reservation, crew dispatch or insurance clearance.
 */
export type LoadedBookingState='loading'|'ready'|'failed';
export type DispatchBookingState='unlinked'|'source-pending'|'source-failed'|'not-loaded'|'inactive'|'loaded';
export type ProjectDispatchRow={
  projectId:string;name:string;phase:'scoping'|'founder-review';
  bookingId:string|null;bookingState:DispatchBookingState;
  bookingDate:string|null;bookingTime:string|null;bookingStatus:string|null;
  plannedAssets:{id:string;name:string;state:string}[];
  assetWarnings:string[];
  sameDayOverlapIds:string[];
  linkedTasks:{id:string;title:string;stage:Card['stage'];assignee:string}[];
  crewHours:number;liftDays:number;buildingCount:number;
  /** Paid labor feasibility under local manual assumptions, never staff availability. */
  crewModel:CrewCapacity;
};
export type FleetDispatchProjection={
  rows:ProjectDispatchRow[];
  bookingState:LoadedBookingState;
  loadedBookings:number;
  sourcedRows:number;unscheduledRows:number;
  assetIssueRows:number;collisionRows:number;
  crewShortfallRows:number;crewUnmodeledRows:number;
  linkedTaskCount:number;
};

export function buildFleetDispatchProjection(
  portfolio:CommercialPortfolio, fleet:FleetWorkbook, bookings:readonly JobItem[],
  bookingState:LoadedBookingState,cards:readonly Card[],org:string,day:string,
):FleetDispatchProjection{
  const authorizedBookings=bookingState==='ready'?bookings:[];
  const active=portfolio.projects.filter(project=>project.phase!=='archived');
  const rows:ProjectDispatchRow[]=active.map(project=>{
    const match=project.bookingId?authorizedBookings.find(job=>job.id.toLowerCase()===project.bookingId):undefined;
    const eligible=!!match&&match.status!=='cancelled'&&match.status!=='denied'&&validDay(match.date);
    const source:DispatchBookingState=!project.bookingId?'unlinked':
      bookingState==='loading'?'source-pending':bookingState==='failed'?'source-failed':
      !match?'not-loaded':!eligible?'inactive':'loaded';
    const assets=projectEquipmentEvidence(project,fleet,day);
    const warnings=assets.filter(a=>a.state!=='recorded-ready').map(a=>a.id);
    if(!assets.length)warnings.push('no candidate equipment selected');
    const related=cards.filter(card=>card.organization_id===org && card.business==='exterior'&&
      exactLocalProjectIds(card.description).includes(project.id)).slice(0,20);
    const totals:EstimateResult=calculateEstimate(project.input);
    return {
      projectId:project.id,name:project.name,phase:project.phase==='founder-review'?'founder-review':'scoping',
      bookingId:project.bookingId,bookingState:source,
      bookingDate:eligible?match!.date:null,bookingTime:eligible?match!.time_block:null,
      bookingStatus:eligible?match!.status:null,
      plannedAssets:assets,assetWarnings:warnings,
      sameDayOverlapIds:[],
      linkedTasks:related.map(t=>({id:t.id,title:t.title,stage:t.stage,assignee:t.assignee})),
      crewHours:totals.crewHours,liftDays:totals.liftDays,buildingCount:totals.sites,
      crewModel:fieldCrewCapacity(project.input,project.fieldCrewPlan??emptyFieldCrewPlan()),
    };
  });
  for(const row of rows){
    if(row.bookingState!=='loaded'||!row.bookingDate)continue;
    const competitors=rows.filter(other=>other.projectId!==row.projectId &&
      other.bookingState==='loaded' && other.bookingDate===row.bookingDate &&
      other.bookingId!==row.bookingId);
    row.sameDayOverlapIds=[...new Set(competitors.flatMap(other=>
      row.plannedAssets.filter(asset=>other.plannedAssets.some(candidate=>candidate.id===asset.id))
        .map(asset=>asset.id)))];
  }
  rows.sort((a,b)=>{
    if(a.bookingDate&&b.bookingDate)return a.bookingDate.localeCompare(b.bookingDate)||a.name.localeCompare(b.name);
    if(a.bookingDate)return -1;
    if(b.bookingDate)return 1;
    return a.name.localeCompare(b.name);
  });
  return {
    rows,bookingState,loadedBookings:authorizedBookings.length,
    sourcedRows:rows.filter(row=>row.bookingState==='loaded').length,
    unscheduledRows:rows.filter(row=>row.bookingState!=='loaded').length,
    assetIssueRows:rows.filter(row=>row.assetWarnings.length>0).length,
    collisionRows:rows.filter(row=>row.sameDayOverlapIds.length>0).length,
    crewShortfallRows:rows.filter(row=>row.crewModel.state==='shortfall').length,
    crewUnmodeledRows:rows.filter(row=>row.crewModel.state==='not-modeled'||row.crewModel.state==='no-labor-entered').length,
    linkedTaskCount:rows.reduce((sum,row)=>sum+row.linkedTasks.length,0),
  };
}
export function calendarHorizon(day:string,count:7|30|90):{start:string;end:string}|null{
  if(!validDay(day))return null;
  const end=new Date(day+'T00:00:00Z');
  end.setUTCDate(end.getUTCDate()+count-1);
  return {start:day,end:end.toISOString().slice(0,10)};
}
export function dispatchRowsInHorizon(
  rows:readonly ProjectDispatchRow[],day:string,horizon:7|30|90,
):{scheduled:ProjectDispatchRow[];outside:ProjectDispatchRow[];unverified:ProjectDispatchRow[]}{
  const range=calendarHorizon(day,horizon);
  const scheduled:ProjectDispatchRow[]=[];
  const outside:ProjectDispatchRow[]=[];
  const unverified:ProjectDispatchRow[]=[];
  for(const row of rows){
    if(!range||row.bookingState!=='loaded'||!row.bookingDate){unverified.push(row);continue;}
    if(row.bookingDate>=range.start&&row.bookingDate<=range.end)scheduled.push(row);
    else outside.push(row);
  }
  return {scheduled,outside,unverified};
}
