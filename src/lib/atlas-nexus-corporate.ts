import type { Card, Activity } from './board';
import type { CommercialPortfolio } from './atlas-commercial-portfolio';
import { projectEquipmentEvidence } from './atlas-commercial-portfolio';
import type { FleetWorkbook } from './fleet-command';
import { fieldCrewCapacity, emptyFieldCrewPlan } from './atlas-field-mission';
import { exactLocalProjectIds } from './atlas-task-handoff';
import { validDay } from './fleet-command';
import type { JobItem } from '@/app/workspace/exterior-actions';

export type LocalCorporateProject = {
  id:string;name:string;phase:'scoping'|'founder-review'|'archived';
  revision:number;sourceDate:string|null;
  bookingState:'unlinked'|'loading'|'failed'|'not-loaded'|'inactive'|'loaded';
  linkedTaskIds:string[];candidateAssets:number;
  crewState:'not-modeled'|'no-labor-entered'|'shortfall'|'assumptions-fit';
  attention:string[];
};
/** This is NOT a new company-wide activity logging system. Only events from
 * already-authorized shared tasks are shown, with no guessed actor identity. */
export type CorporateTaskActivity = {
  id:string;title:string;venture:string;cardId:string;action:Activity['action'];at:string;
};
export type CorporateNexusOverlay = {
  projects:LocalCorporateProject[];
  activeLocalProjects:number;projectsNeedingReview:number;sourceMatchedProjects:number;
  withTaskSnapshot:number;crewShortfalls:number;
  taskActivity:CorporateTaskActivity[];
  sourceState:'loading'|'ready'|'failed';
  hasLocalFleet:boolean;
  sourceNote:string;
};

export function buildCorporateNexusOverlay(input:{
  org:string;portfolio:CommercialPortfolio;fleet:FleetWorkbook|null;
  jobs:readonly JobItem[];jobState:'loading'|'ready'|'failed';
  cards:readonly Card[];activity:readonly Activity[];
  today:string;
}):CorporateNexusOverlay{
  if(input.portfolio.organizationId!==input.org)
    throw new Error('Corporate overlay source belongs to another organization.');
  if(input.fleet!==null && input.fleet.organizationId!==input.org)
    throw new Error('Corporate overlay Fleet source belongs to another organization.');
  const jobs=input.jobState==='ready'?input.jobs:[];
  const authorizedCards=input.cards.filter(c=>c.organization_id===input.org);
  const taskIdSet=new Set(authorizedCards.map(c=>c.id));
  const activity=input.activity.filter(a=>taskIdSet.has(a.card_id)&&Number.isFinite(Date.parse(a.created_at)))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,18).map(a=>{
      const card=authorizedCards.find(c=>c.id===a.card_id)!;
      return {id:a.id,title:card.title,venture:card.business,cardId:a.card_id,action:a.action,at:a.created_at};
    });
  const projects:LocalCorporateProject[]=input.portfolio.projects.map(project=>{
    const job=project.bookingId?jobs.find(j=>j.id.toLowerCase()===project.bookingId!.toLowerCase()):undefined;
    const state:LocalCorporateProject['bookingState']=!project.bookingId?'unlinked':
      input.jobState==='loading'?'loading':input.jobState==='failed'?'failed':
      !job?'not-loaded':job.status==='cancelled'||job.status==='denied'||!validDay(job.date)?'inactive':'loaded';
    const tasks=authorizedCards.filter(c=>c.business==='exterior'&&
      exactLocalProjectIds(c.description).includes(project.id));
    const crew=fieldCrewCapacity(project.input,project.fieldCrewPlan??emptyFieldCrewPlan());
    const assets=projectEquipmentEvidence(project,input.fleet,input.today);
    const attention:string[]=[];
    if(state==='inactive')attention.push('Linked source booking is inactive or has an invalid date');
    if(crew.state==='shortfall')attention.push('Modeled paid crew-hour shortfall');
    if(assets.some(a=>['out-of-service','needs-service','due'].includes(a.state)))
      attention.push('Equipment marked due, needs service or out of service');
    if(project.input.sites.some(s=>s.access==='review'))
      attention.push('At least one building access strategy is unassessed');
    if(project.input.sites.some(s=>s.access==='lift'&&s.liftDays===0))
      attention.push('Lift-access work has no entered rental days');
    return {
      id:project.id,name:project.name,phase:project.phase,revision:project.revision,
      sourceDate:state==='loaded'&&job?job.date:null,
      bookingState:state,
      linkedTaskIds:tasks.map(t=>t.id),candidateAssets:assets.length,
      crewState:crew.state,attention,
    };
  }).sort((a,b)=>{
    const aAttention=a.attention.length,bAttention=b.attention.length;
    return bAttention-aAttention||a.name.localeCompare(b.name);
  });
  return {
    projects,
    activeLocalProjects:projects.filter(p=>p.phase!=='archived').length,
    projectsNeedingReview:projects.filter(p=>p.phase!=='archived'&&p.attention.length>0).length,
    sourceMatchedProjects:projects.filter(p=>p.bookingState==='loaded').length,
    withTaskSnapshot:projects.filter(p=>p.linkedTaskIds.length>0).length,
    crewShortfalls:projects.filter(p=>p.crewState==='shortfall').length,
    taskActivity:activity,sourceState:input.jobState,hasLocalFleet:input.fleet!==null,
    sourceNote:input.jobState==='failed'
      ?'Exterior booking source is unavailable. Never interpret missing links as zero scheduled work.'
      :input.jobState==='loading'
      ?'Exterior bookings are loading; no project has a confirmed source match yet.'
      :'Exact booking IDs are matched against the authorized loaded window only. Coverage may be partial.',
  };
}
