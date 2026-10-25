import type { CommercialPortfolio, CommercialProject } from './atlas-commercial-portfolio';
import { projectEquipmentEvidence } from './atlas-commercial-portfolio';
import { calculateEstimate } from './commercial-estimate';
import { fieldCrewCapacity, fieldWorkforceFindings, emptyFieldCrewPlan } from './atlas-field-mission';
import { exactLocalProjectIds } from './atlas-task-handoff';
import type { FleetWorkbook } from './fleet-command';
import { validDay } from './fleet-command';
import type { ExtBooking, ExtLead } from './exterior';
import type { Card, Activity } from './board';

/**
 * NEXUS R13 is a SOURCE-AWARE, READ-ONLY projection. It does NOT create
 * canonical server-side project, property or equipment identities. Every edge
 * records exactly where its association came from. A reference copied into a
 * task is a TEXT RECEIPT, not a database FK.
 */
export type NexusEvidence = 'verified-source-record' | 'shared-organization-record' | 'device-local-plan' | 'text-reference' | 'unverified';
export type NexusKind = 'project' | 'building' | 'booking' | 'customer' | 'equipment' | 'task' | 'estimate';
export type NexusNode = {
  id:string; kind:NexusKind; title:string; secondary:string; evidence:NexusEvidence;
};
export type NexusEdge = {from:string; to:string; label:string; evidence:NexusEvidence};
export type NexusFinding = {id:string; priority:'attention'|'review'|'unknown'; title:string; detail:string};
export type NexusActivity = {id:string;cardId:string;at:string;action:Activity['action'];title:string};
export type NexusProject = {
  id:string;name:string;revision:number;phase:CommercialProject['phase'];updatedAt:string;
  buildings:number;panes:number;crewHours:number;liftDays:number;
  estimatedCost:number;scenarioPrice:number;modeledContribution:number;
  crewState:'not-modeled'|'no-labor-entered'|'shortfall'|'assumptions-fit';
  crewGap:number|null;
  booking:{id:string|null;state:'unlinked'|'matched'|'inactive'|'not-loaded'|'invalid-date';date:string|null;time:string|null;status:string|null};
  customer:{state:'source-linked'|'not-loaded'|'unlinked';name:string|null;id:string|null};
  assets:{id:string;name:string;state:string}[];
  tasks:{id:string;title:string;stage:Card['stage'];assignee:string;dueDate:string;completed:boolean}[];
  activity:NexusActivity[];
  nodes:NexusNode[];edges:NexusEdge[];
  findings:NexusFinding[];
};
export type NexusOverview = {
  projects:NexusProject[];
  active:number;sourceMatchedBookings:number;attentionProjects:number;
  crewShortfalls:number;localEquipmentPlans:number;linkedSharedTasks:number;
  /** Coverage is the load result's total, never an assertion that all data exists. */
  sourceCoverage:{
    bookings:{loaded:number;total:number|null};
    leads:{loaded:number;total:number|null};
  };
  hasFleetWorkbook:boolean;
  hasRealProjectPersistence:true;
};
export type NexusInputs = {
  org:string;portfolio:CommercialPortfolio;fleet:FleetWorkbook|null;
  bookings:readonly ExtBooking[];leads:readonly ExtLead[];
  cards:readonly Card[];activity:readonly Activity[];
  today:string;
  coverage?:{
    bookings:{loaded:number;total:number|null};
    leads:{loaded:number;total:number|null};
  };
};

export function buildNexusProject(project:CommercialProject, all:NexusInputs):NexusProject{
  // Caller must have used decodeCommercialPortfolio(org). Guard even here to
  // prevent rendering accidental cross-company local or task context.
  if(all.portfolio.organizationId!==all.org ||
    (all.fleet && all.fleet.organizationId!==all.org) ||
    !all.portfolio.projects.some(candidate=>candidate.id===project.id)){
    throw new Error('Project is not part of the validated current organization.');
  }
  const estimate=calculateEstimate(project.input);
  const crew=fieldCrewCapacity(project.input,project.fieldCrewPlan??emptyFieldCrewPlan());
  const candidate=project.bookingId
    ?all.bookings.find(b=>b.id.toLowerCase()===project.bookingId!.toLowerCase()):undefined;
  const bookingState:NexusProject['booking']['state']=!project.bookingId?'unlinked':
    !candidate?'not-loaded':
    candidate.status==='cancelled'||candidate.status==='denied'?'inactive':
    !validDay(candidate.date)?'invalid-date':'matched';
  const booking={
    id:project.bookingId,
    state:bookingState,
    date:bookingState==='matched'?candidate!.date:null,
    time:bookingState==='matched'?candidate!.time_block:null,
    status:bookingState==='matched'?candidate!.status:null,
  };
  // Existing booking→lead source FK is the only company/customer match.
  // NEVER correlate people by property name, phone, note, quote or address.
  const lead=bookingState==='matched'&&candidate?.lead_id
    ?all.leads.find(l=>l.id.toLowerCase()===candidate.lead_id!.toLowerCase()):undefined;
  const customer={
    id:lead?.id??null,
    state:(lead?'source-linked':bookingState==='matched'&&candidate?.lead_id?'not-loaded':'unlinked') as NexusProject['customer']['state'],
    name:lead?.name??null,
  };
  const tasks=all.cards.filter(c=>c.organization_id===all.org&&c.business==='exterior'&&
    exactLocalProjectIds(c.description).includes(project.id)).slice(0,25);
  const taskIds=new Set(tasks.map(c=>c.id));
  const activity=all.activity.filter(a=>taskIds.has(a.card_id)&&Number.isFinite(Date.parse(a.created_at)))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,30)
    .map(a=>({id:a.id,cardId:a.card_id,at:a.created_at,action:a.action,
      title:tasks.find(t=>t.id===a.card_id)?.title??'Workspace task'}));
  const assets=projectEquipmentEvidence(project,all.fleet,all.today);
  const nodes:NexusNode[]=[
    {id:'project:'+project.id,kind:'project',title:project.name,secondary:'Shared revision '+project.revision,evidence:'shared-organization-record'},
    {id:'estimate:'+project.id,kind:'estimate',title:'Cost engineering',secondary:'Internal scenario only',evidence:'shared-organization-record'},
  ];
  const edges:NexusEdge[]=[
    {from:'project:'+project.id,to:'estimate:'+project.id,label:'shared immutable version',evidence:'shared-organization-record'},
  ];
  for(const site of project.input.sites){
    nodes.push({id:'building:'+project.id+':'+site.id,kind:'building',
      title:site.name||'Unnamed building',secondary:site.panes+' estimated panes',evidence:'shared-organization-record'});
    edges.push({from:'project:'+project.id,to:'building:'+project.id+':'+site.id,
      label:'saved building scope',evidence:'shared-organization-record'});
  }
  if(bookingState==='matched' && candidate){
    nodes.push({id:'booking:'+candidate.id,kind:'booking',title:'Exterior booking',
      secondary:candidate.date+' · '+(candidate.time_block??'time unentered'),evidence:'verified-source-record'});
    edges.push({from:'project:'+project.id,to:'booking:'+candidate.id,
      label:'stored booking ID resolved in source',evidence:'shared-organization-record'});
  }else if(project.bookingId){
    nodes.push({id:'unverified-booking:'+project.bookingId,kind:'booking',title:'Unverified booking reference',
      secondary:bookingState==='inactive'?'Inactive source record':'Source coverage or status unknown',evidence:'unverified'});
    edges.push({from:'project:'+project.id,to:'unverified-booking:'+project.bookingId,
      label:'unverified local reference',evidence:'unverified'});
  }
  if(lead){
    nodes.push({id:'customer:'+lead.id,kind:'customer',title:lead.name||'Unnamed source lead',
      secondary:'Exact booking lead ID',evidence:'verified-source-record'});
    edges.push({from:'booking:'+candidate!.id,to:'customer:'+lead.id,
      label:'source booking.lead_id',evidence:'verified-source-record'});
  }
  for(const asset of assets){
    nodes.push({id:'equipment:'+asset.id,kind:'equipment',title:asset.name,
      secondary:asset.state,evidence:asset.state==='missing'?'unverified':'device-local-plan'});
    edges.push({from:'project:'+project.id,to:'equipment:'+asset.id,
      label:'candidate only—not reserved',evidence:'device-local-plan'});
  }
  for(const task of tasks){
    nodes.push({id:'task:'+task.id,kind:'task',title:task.title,
      secondary:task.stage+' · '+(task.assignee||'unassigned'),evidence:'verified-source-record'});
    edges.push({from:'project:'+project.id,to:'task:'+task.id,
      label:'exact ID in task text; not FK',evidence:'text-reference'});
  }

  const findings:NexusFinding[]=[];
  if(project.phase==='archived'){
    findings.push({id:'archived',priority:'review',title:'Project archived locally',
      detail:'Archived does not prove completion, client approval or payment.'});
  }
  if(bookingState==='unlinked')findings.push({id:'booking-unlinked',priority:'unknown',
    title:'No source booking',detail:'Project is a local plan only. No booking ID was associated.'});
  else if(bookingState==='not-loaded')findings.push({id:'booking-unloaded',priority:'unknown',
    title:'Booking not available in loaded records',detail:'The exact ID has not been resolved. Source coverage can be partial; missing does not mean nonexistent.'});
  else if(bookingState==='inactive')findings.push({id:'booking-inactive',priority:'attention',
    title:'Linked booking inactive',detail:'Source booking is recorded as cancelled or denied. Do not treat this as scheduled field work.'});
  else if(bookingState==='invalid-date')findings.push({id:'booking-invalid',priority:'unknown',
    title:'Booking calendar date invalid',detail:'A source record exists, but its date cannot support scheduling.'});
  if(customer.state==='not-loaded')findings.push({id:'customer-unloaded',priority:'unknown',
    title:'Customer not loaded',detail:'Booking lead_id does not resolve within the loaded authorized lead set. Do not infer an identity by name.'});
  if(crew.state==='shortfall')findings.push({id:'crew-shortfall',priority:'attention',
    title:'Modeled labor-capacity gap',detail:'Entered workforce scenario is short by '+Math.abs(crew.capacityGapHours??0)+' paid person-hours. No actual crew has been scheduled.'});
  if(crew.state==='not-modeled'||crew.state==='no-labor-entered')findings.push({
    id:'crew-unknown',priority:'unknown',title:'Workforce capacity unknown',
    detail:'The source estimate or manual crew/day assumptions are incomplete.'});
  for(const issue of fieldWorkforceFindings(project.input,project.fieldCrewPlan??emptyFieldCrewPlan())){
    if(issue.id==='access-unassessed'||issue.id==='rental-unmodeled')
      findings.push({id:issue.id,priority:issue.severity==='attention'?'attention':'review',title:issue.id==='access-unassessed'?'Access needs assessment':'Lift rental days missing',detail:issue.text});
  }
  if(!assets.length)findings.push({id:'equipment-none',priority:'unknown',
    title:'Equipment plan absent',detail:'No candidate assets were listed; no field equipment has been reserved.'});
  for(const asset of assets){
    if(asset.state==='out-of-service'||asset.state==='needs-service'||asset.state==='due')
      findings.push({id:'equipment-'+asset.id,priority:'attention',
        title:'Equipment service attention',detail:asset.name+' is recorded as '+asset.state+'. This is not a verified inspection.'});
    if(asset.state==='missing'||asset.state==='unverified')
      findings.push({id:'equipment-'+asset.id,priority:'unknown',title:'Equipment state not established',
        detail:'Planned asset '+asset.id+' is absent from this device or lacks recorded service evidence.'});
    if(asset.state==='due-soon')
      findings.push({id:'equipment-'+asset.id,priority:'review',title:'Equipment service approaching',
        detail:asset.name+' is approaching a manually entered service threshold.'});
  }
  if(!tasks.length)findings.push({id:'task-none',priority:'review',title:'No related shared task snapshots',
    detail:'No loaded, authorized Exterior tasks contain this exact shared project ID. This does not establish there is no work elsewhere.'});
  if(project.review.some(done=>!done))findings.push({id:'bid-review',priority:'review',
    title:'Bid review checklist incomplete',detail:'Checked items are internal notes, not a founder signature or customer contract.'});
  const otherProjects=all.portfolio.projects.filter(p=>p.id!==project.id&&p.phase!=='archived'&&p.bookingId);
  for(const other of otherProjects){
    const otherBooking=all.bookings.find(b=>b.id.toLowerCase()===other.bookingId!.toLowerCase());
    if(booking.state!=='matched'||!otherBooking||otherBooking.id===candidate?.id||
      !validDay(otherBooking.date)||otherBooking.status==='cancelled'||otherBooking.status==='denied'||
      otherBooking.date!==booking.date)continue;
    const overlap=other.plannedAssetIds.filter(id=>project.plannedAssetIds.includes(id));
    if(overlap.length)findings.push({id:'asset-overlap-'+other.id,priority:'review',
      title:'Possible same-day resource contention',detail:overlap.length+
      ' candidate asset ID(s) also appear on another locally planned project with a different source booking on this date. Time overlap not proven.'});
  }
  return {
    id:project.id,name:project.name,revision:project.revision,phase:project.phase,updatedAt:project.updatedAt,
    buildings:estimate.sites,panes:estimate.panes,crewHours:estimate.crewHours,liftDays:estimate.liftDays,
    estimatedCost:estimate.totalCost,scenarioPrice:estimate.suggestedPrice,
    modeledContribution:estimate.contribution,
    crewState:crew.state,crewGap:crew.capacityGapHours,booking,customer,assets,
    tasks:tasks.map(t=>({id:t.id,title:t.title,stage:t.stage,assignee:t.assignee,dueDate:t.due_date,completed:t.stage==='Done'})),
    activity,nodes,edges,findings,
  };
}
export function buildNexusOverview(inputs:NexusInputs):NexusOverview{
  if(inputs.org!==inputs.portfolio.organizationId)
    throw new Error('Portfolio does not belong to the current organization.');
  if(inputs.fleet && inputs.fleet.organizationId!==inputs.org)
    throw new Error('Fleet workbook belongs to a different organization.');
  const projects=inputs.portfolio.projects.map(p=>buildNexusProject(p,inputs))
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.name.localeCompare(b.name));
  return {
    projects,
    active:projects.filter(p=>p.phase!=='archived').length,
    sourceMatchedBookings:projects.filter(p=>p.booking.state==='matched').length,
    attentionProjects:projects.filter(p=>p.findings.some(f=>f.priority==='attention')).length,
    crewShortfalls:projects.filter(p=>p.crewState==='shortfall').length,
    localEquipmentPlans:projects.filter(p=>p.assets.length>0).length,
    linkedSharedTasks:new Set(projects.flatMap(p=>p.tasks.map(t=>t.id))).size,
    sourceCoverage:inputs.coverage??{
      bookings:{loaded:inputs.bookings.length,total:null},
      leads:{loaded:inputs.leads.length,total:null},
    },
    hasFleetWorkbook:inputs.fleet!==null,
    hasRealProjectPersistence:true,
  };
}
